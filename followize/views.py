from cProfile import Profile
from HTMLParser import HTMLParseError
from logging import getLogger
from pstats import Stats
from StringIO import StringIO
from urllib2 import HTTPError

from google.appengine.api import memcache
from google.appengine.api.urlfetch import fetch

from django.conf import settings
from django.core.urlresolvers import reverse
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import render_to_response
from django.utils.translation import ugettext as _

from BeautifulSoup import BeautifulSoup

from afternoon.django.templatetags import AT_REPLIES_RE

from forms import LoginForm, PostForm
from twitter import AuthenticationException, parse_time, time_call, \
        TimeoutException, Twitter, TwitterError


log = getLogger(__name__)


def user(session):
    username = session.get("username", None)
    if not username:
        return None

    data = memcache.get("%s_info" % username)
    if not data:
        password = session["password"]
        tw = Twitter(username, password)
        data = tw.user(username)
        memcache.add("%s_info" % username, data,
                settings.FOLLOWIZE_CACHE_TIMEOUT_USER_INFO)
    return data


def fail(request, message):
    if message[-1:] not in u".?!":
        message += u"."
    ctx = {
        "message":  message,
        "user":     user(request.session)
    }
    return render_to_response(u"500.html", ctx)


def index(request, form=None):
    """Show home page with simple blurb and log in form, like Facebook."""
    # redirect to home if we have username/password
    if u"username" in request.session:
        return HttpResponseRedirect(reverse("home"))

    # create an empty form if required
    if not form:
        if request.method == u"GET":
            form = LoginForm()
        else:
            form = LoginForm(request.POST)

    # display blurb page
    return render_to_response(u"followize/index.html", {"form": form})


def add_reply_data(tw, f):
    if f["status"]["in_reply_to_status_id"]:
        matches = AT_REPLIES_RE.match(f["status"]["text"])
        if matches:
            user_data = {"screen_name": matches.groups()[0]}
            f["status"]["in_reply_to_user"] = user_data
    return f


def reply_to_me(tw, f):
    if "in_reply_to_user" in f["status"]:
        reply_to_name = f["status"]["in_reply_to_user"]["screen_name"]
        f["status"]["in_reply_to_me"] = reply_to_name == tw.username
    return f


def page_title(url):
    title = memcache.get("%s_title" % url)
    if not title:
        title = url
        try:
            response, secs = time_call(fetch, url, allow_truncated=True)
        except Exception, e:
            log.info(u"Exception %s, %s" % (type(e), e))
            if str(e) == u"timed out":
                raise TimeoutException(_(u"Request to Twitter timed out"))
            else:
                raise e
        log.info("fetch(\"%s\") took %s secs" % (url, secs))

        if response.status_code == 200 and \
                response.headers["Content-Type"] == "text/html":
            try:
                bs = BeautifulSoup(unicode(response.content[:2048]))
                if bs.title:
                    title = "".join(bs.title.contents)
            except HTMLParseError:
                pass
        memcache.add("%s_title" % url, title,
                settings.FOLLOWIZE_CACHE_TIMEOUT_TITLES)
    return title


def link_up(t):
    if t.lower().startswith(("http://", "https://")):
        return """<a href="%s">%s</a>""" % (t, page_title(t))
    else:
        return t


def link_titles(tw, f):
    if settings.FOLLOWIZE_ADD_LINK_TITLES:
        tokens = f["status"]["text"].split()
        f["status"]["text"] = u" ".join([link_up(t) for t in tokens])
    return f


def following(username, password, page=1):
    data = memcache.get("%s_following_%s" % (username, page))
    if not data:
        tw = Twitter(username, password)
        data = tw.following(page)

        def cmp_following(x, y):
            return cmp(parse_time(x["status"]["created_at"]),
                    parse_time(y["status"]["created_at"]))
        data = sorted(data, cmp=cmp_following, reverse=True)
        
        data = [link_titles(tw, reply_to_me(tw, add_reply_data(tw, f)))
                for f in data]

        memcache.add("%s_following_%s" % (username, page), data,
                settings.FOLLOWIZE_CACHE_TIMEOUT_UPDATES)
    return data


def login(request):
    """Validate user's Twitter details and store them somewhere useful"""
    if request.method == u"GET":
        return HttpResponseRedirect(reverse("index"))

    # basic input validation
    form = LoginForm(request.POST)
    if form.errors:
        return index(request, form)

    # try to get following from Twitter
    username = form.cleaned_data["username"]
    password = form.cleaned_data["password"]
    tw = Twitter(username, password)
    try:
        user_info = tw.user(username)
    except AuthenticationException:
        form.errors["password"] = [_(u"Wrong username and password combination")]
        return index(request, form)
    except TwitterError, e:
        return fail(request, _(u"Twitter error: %s") % e.message)
    except Exception, e:
        return fail(request, e.message)

    if user_info:
        request.session["username"] = username
        request.session["password"] = password
        memcache.add("%s_info" % username, user_info,
                settings.FOLLOWIZE_CACHE_TIMEOUT_USER_INFO)
        log.info(u"%s logged in, following %s" % (user_info["screen_name"],
            user_info["friends_count"]))
        return HttpResponseRedirect(reverse("home"))
    else:
        raise Exception(u"Unknown Twitter error")


def logout(request):
    request.session.clear()
    return HttpResponseRedirect(reverse("index"))


def username_required(f):
    def f_(request, *args, **kwargs):
        if "username" not in request.session:
            return HttpResponseRedirect(reverse("index"))
        else:
            return f(request, *args, **kwargs)
    return f_


def home_p(request):
    """Show the latest update from each followed Twitterer using list_detail"""
    prof = Profile()
    prof = prof.runctx("home(request)", globals(), locals())
    stream = StringIO()
    stats = Stats(prof, stream=stream)
    stats.sort_stats("time").print_stats(80)
    log.info("Profile data:\n%s", stream.getvalue())
    return HttpResponse(u"OK")
    

def pages(following_count):
    n = following_count / settings.TWITTER_FRIENDS_PAGE_LENGTH
    if following_count % settings.TWITTER_FRIENDS_PAGE_LENGTH > 0:
        n += 1
    return range(1, n + 1)


@username_required
def home(request):
    try:
        page = int(request.GET.get("page", 1))
    except ValueError:
        return fail(request, u"%s is not a valid page number" %
                request.GET.get("page", u""))
    username = request.session["username"]
    password = request.session["password"]
    try:
        user_following = following(username, password, page)
    except TwitterError, e:
        return fail(request, _(u"Twitter error: %s") % e.message)
    except TimeoutException, e:
        return fail(request, _(u"Couldn't load data about people you follow."
                u" Twitter is too slow."))

    u = user(request.session)
    page_list = pages(u["friends_count"])
    ctx = {
        "user":         u,
        "following":    user_following,
        "updated":      request.GET.get("updated", False),
        "page":         page,
        "pages":        page_list,
        "previous":     page - 1 if page != 1 else None,
        "next":         page + 1 if page != page_list[-1] else None
    }
    return render_to_response(u"followize/home.html", ctx)


@username_required
def post(request):
    """Post to Twitter"""
    form = PostForm(request.REQUEST)
    u = user(request.session)

    if request.method == u"POST" and not form.errors:
        status = form.cleaned_data["status"]
        in_reply_to = form.cleaned_data.get("in_reply_to", u"")

        try:
            tw = Twitter(u["screen_name"], u["password"])
            tw.update(status, in_reply_to)
        except:
            return fail(request, _(u"Couldn't post update to Twitter due to"
                    u" their lameness. Sorry."))

        return HttpResponseRedirect(reverse("home") + u"?updated=true")

    if request.method == u"GET":
        form["status"].field.required = False

    ctx = {
        "form":     form,
        "user":     u,
    }
    return render_to_response(u"followize/post.html", ctx)
