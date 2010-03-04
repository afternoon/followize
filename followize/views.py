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

from decorators import auth_required
from twitter import AuthenticationException, num_pages, TimeoutException, \
        Twitter, TwitterError


log = getLogger()


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
    if u"oauth_token_str" in request.session:
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
    oauth_token_str = tw.exchange_request_token_for_access_token(token)
    request.session["oauth_token_str"] = oauth_token_str.to_string()

    u = tw.verify_credentials()
    log.info(u"%s logged in, following %s" % (u["screen_name"],
            u["friends_count"]))
    request.session["screen_name"] = u["screen_name"]

    return HttpResponseRedirect(reverse("home"))


def auth_clear(request):
    request.session.clear()
    return HttpResponseRedirect(reverse("index"))


def home_p(request):
    """Profiled version of home"""
    prof = Profile()
    prof = prof.runctx("home(request)", globals(), locals())
    stream = StringIO()
    stats = Stats(prof, stream=stream)
    stats.sort_stats("time").print_stats(80)
    log.info("Profile data:\n%s", stream.getvalue())
    return HttpResponse(u"OK")
    

@auth_required
def home(request):
    """Return a boiler plate HTML doc which bootstraps the JS front-end. The
    OAuth access token is passed.
    
    """
    oauth_token = OAuthToken.from_string(request.session["oauth_token_str"])
    ctx = {
        "oauth_token":          oauth_token.key,
        "oauth_consumer_key":   settings.TWITTER_OAUTH_CONSUMER_KEY
    }
    return render_to_response(u"followize/home.html", ctx)
