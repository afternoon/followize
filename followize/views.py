from cProfile import Profile
from logging import getLogger
from pstats import Stats
from StringIO import StringIO

from django.conf import settings
from django.core.paginator import Paginator
from django.core.urlresolvers import reverse
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import render_to_response
from django.utils.translation import ugettext as _

from forms import LoginForm, PostForm
from decorators import username_required
from models import following, is_follower, session_user, update, user
from twitter import AuthenticationException, num_pages, TimeoutException, \
        Twitter, TwitterError


log = getLogger(__name__)


def fail(request, message):
    if message[-1:] not in u".?!":
        message += u"."
    ctx = {
        "message":  message,
        "user":     session_user(request.session)
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


def login(request):
    """Validate user's Twitter details and store them somewhere useful"""
    if request.method == u"GET":
        return HttpResponseRedirect(reverse("index"))

    # basic input validation
    form = LoginForm(request.POST)
    if form.errors:
        return index(request, form)

    # check user creds with Twitter
    tw = Twitter(form.cleaned_data["username"], form.cleaned_data["password"])
    try:
        user_info = tw.verify_credentials()
    except AuthenticationException:
        form.errors["password"] = [_(u"Wrong username and password"
                u" combination.")]
        return index(request, form)
    except TwitterError, e:
        return fail(request, _(u"Twitter error: %s") % e.message)
    except Exception, e:
        return fail(request, e.message)

    if user_info and "error" not in user_info:
        request.session["username"] = tw.username
        request.session["password"] = tw.password
        log.info(u"%s logged in, following %s" % (user_info["screen_name"],
            user_info["friends_count"]))
        return HttpResponseRedirect(reverse("home"))
    else:
        raise Exception(u"Unknown Twitter error")


def logout(request):
    request.session.clear()
    return HttpResponseRedirect(reverse("index"))


def home_p(request):
    """Show the latest update from each followed Twitterer using list_detail"""
    prof = Profile()
    prof = prof.runctx("home(request)", globals(), locals())
    stream = StringIO()
    stats = Stats(prof, stream=stream)
    stats.sort_stats("time").print_stats(80)
    log.info("Profile data:\n%s", stream.getvalue())
    return HttpResponse(u"OK")
    

@username_required
def home(request):
    try:
        page = int(request.GET.get("page", 1))
    except ValueError:
        return fail(request, u"%s is not a valid page number" %
                request.GET.get("page", u""))
    tw = Twitter(request.session["username"], request.session["password"])
    try:
        user_following = following(tw)
    except TwitterError, e:
        return fail(request, _(u"Twitter error: %s") % e.message)
    except TimeoutException, e:
        return fail(request, _(u"Couldn't load data about people you follow."
                u" Twitter is too slow."))

    u = session_user(request.session)
    paginator = Paginator(user_following, settings.FOLLOWIZE_PAGE_LENGTH)
    p = paginator.page(page)
    ctx = {
        "user":         u,
        "following":    p.object_list,
        "page_range":   [paginator.page(i) for i in paginator.page_range],
        "current_page": p,
        "form":         PostForm()
    }
    return render_to_response(u"followize/home.html", ctx)


def cant_dm(request, recipient):
    return fail(request, _(u"You can't send direct messages to %s."
            u" They don't follow you.<br><br>"
            u" You could <a href=\"%s?status=%%40%s+\">@reply</a> instead." %
            (recipient, reverse("post"), recipient)))


@username_required
def post(request):
    """Post to Twitter"""
    form = PostForm(request.REQUEST)
    u = session_user(request.session)

    tw = Twitter(request.session["username"], request.session["password"])

    if request.method == u"POST" and not form.errors:
        status = form.cleaned_data["status"]
        in_reply_to = form.cleaned_data.get("in_reply_to", u"")

        if status.startswith(u"d "):
            recipient = status.split()[1]
            if not is_follower(tw, recipient):
                return cant_dm(request, recipient)

        try:
            update(tw, status, in_reply_to)
        except:
            return fail(request, _(u"Couldn't post update to Twitter due to"
                    u" their lameness. Refresh to try again."))

        return HttpResponseRedirect(reverse("home"))

    if request.method == u"GET":
        status = request.GET.get("status", u"")
        if status.startswith(u"d "):
            recipient = status.split()[1]
            if not is_follower(tw, recipient):
                return cant_dm(request, recipient)

        form["status"].field.required = False

    ctx = {
        "form":     form,
        "user":     u,
    }
    return render_to_response(u"followize/post.html", ctx)
