from cProfile import Profile
from logging import getLogger
from pstats import Stats
from StringIO import StringIO

from google.appengine.api.urlfetch_errors import DownloadError

from django.conf import settings
from django.core.paginator import EmptyPage, Paginator
from django.core.urlresolvers import reverse
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import render_to_response
from django.utils.simplejson import dumps
from django.utils.translation import ugettext as _

from oauth import OAuthToken

from decorators import return_json, auth_required
from forms import PostForm
from models import following, is_follower, session_user, update
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


def index(request):
    """Show home page with simple blurb and log in form, like Facebook."""
    # redirect to home if we have authenticated user
    if u"access_token" in request.session:
        return HttpResponseRedirect(reverse("home"))

    # display blurb page
    return render_to_response(u"followize/index.html")


def auth(request):
    """Kick off the OAuth process"""
    tw = Twitter()
    try:
        token = tw.new_request_token()
    except DownloadError:
        return fail(request, _(u"Twitter is not responding!"
            u" Refresh to try again."))
    auth_url = tw.authorisation_url(token)
    request.session["unauthed_token"] = token.to_string()   
    return HttpResponseRedirect(auth_url)


def auth_return(request):
    """Get the access token back from Twitter and load user info"""
    auth_broken_msg = _(u"Authentication with Twitter went wrong."
            u" <a href=\"/\">Start over</a>.")

    unauthed_token = request.session.get("unauthed_token", None)
    if not unauthed_token:
        return fail(request, auth_broken_msg)

    token = OAuthToken.from_string(unauthed_token)   
    if token.key != request.GET.get("oauth_token", "no-token"):
        return fail(request, auth_broken_msg)

    tw = Twitter()
    access_token = tw.exchange_request_token_for_access_token(token)
    request.session["access_token"] = access_token.to_string()

    u = tw.verify_credentials()
    log.info(u"%s logged in, following %s" % (u["screen_name"],
            u["friends_count"]))
    request.session["screen_name"] = u["screen_name"]

    return HttpResponseRedirect(reverse("home"))


def auth_clear(request):
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
    

@auth_required
def home(request):
    try:
        page = int(request.GET.get("page", 1))
    except ValueError:
        return fail(request, u"%s doesn't work as a page number. Go back." %
                request.GET.get("page", u""))
    tw = Twitter(request.session["access_token"])
    try:
        user_following = following(tw, request.session["screen_name"])
    except TwitterError, e:
        return fail(request, e.message)
    except (DownloadError, TimeoutException):
        return fail(request, _(u"Failed to get lovely tweets from Twitter."
            u" Refresh to try again."))

    u = session_user(request.session)
    paginator = Paginator(user_following, settings.FOLLOWIZE_PAGE_LENGTH)
    try:
        p = paginator.page(page)
    except EmptyPage, e:
        return fail(request, "Oops, you went too far. Go back.")

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
            u" <a href=\"%s?status=%%40%s+\">@mention them</a>." %
            (recipient, reverse("post"), recipient)))


@auth_required
def post(request):
    """Post to Twitter"""
    form = PostForm(request.REQUEST)
    u = session_user(request.session)

    tw = Twitter(request.session["access_token"])

    if request.method == u"POST" and not form.errors:
        status = form.cleaned_data["status"]
        in_reply_to = form.cleaned_data.get("in_reply_to", u"")

        if status.startswith(u"d "):
            recipient = status.split()[1]
            if not is_follower(tw, recipient):
                return cant_dm(request, recipient)

        try:
            update(tw, request.session["screen_name"], status, in_reply_to)
        except:
            return fail(request, _(u"Couldn't post to Twitter, they are lame."
                u" Refresh to try again."))

        return HttpResponseRedirect(reverse("home"))

    if request.method == u"GET":
        status = request.GET.get("status", u"")
        if status.startswith(u"d "):
            recipient = status.split()[1]
            if not is_follower(tw, recipient):
                return cant_dm(request, recipient)

        form["status"].field.required = False

    if "in_reply_to" in form.errors:
        return fail(request, _(u"%s is not a valid status to reply to." %
                request.REQUEST["in_reply_to"]))

    ctx = {
        "form":     form,
        "user":     u,
    }
    return render_to_response(u"followize/post.html", ctx)


@auth_required
@return_json
def json_status(request, status_id):
    tw = Twitter(request.session["access_token"])
    return tw.status(status_id, raw=True)


@auth_required
@return_json
def json_timeline(request, screen_name):
    tw = Twitter(request.session["access_token"])
    return tw.timeline(screen_name, count=request.GET.get("count", 20), raw=True)
