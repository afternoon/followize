from base64 import encodestring
from datetime import datetime, timedelta, tzinfo
from logging import getLogger
from time import strptime, time
from urllib import urlencode

from google.appengine.api.urlfetch import fetch, GET, POST

from django.conf import settings
from django.utils.simplejson import loads
from django.utils.translation import ugettext as _

from oauth import OAuthSignatureMethod_HMAC_SHA1, OAuthConsumer, OAuthRequest, \
        OAuthToken


log = getLogger(__name__)


URL_VERIFY_CREDENTIALS = "http://twitter.com/account/verify_credentials.json"
URL_USER = "http://twitter.com/users/show/%s.json"
URL_TIMELINE = "http://twitter.com/statuses/user_timeline/%s.json"
URL_FOLLOWING = "http://twitter.com/statuses/friends.json"
URL_STATUS = "http://twitter.com/statuses/show/%s.json"
URL_UPDATE = "http://twitter.com/statuses/update.json"


URL_OAUTH_REQUEST_TOKEN = "https://twitter.com/oauth/request_token"
URL_OAUTH_ACCESS_TOKEN = "https://twitter.com/oauth/access_token"
URL_OAUTH_AUTHORIZATION = "http://twitter.com/oauth/authorize"


MONTHS = {
    "jan":  1,
    "feb":  2,
    "mar":  3,
    "apr":  4,
    "may":  5,
    "jun":  6,
    "jul":  7,
    "aug":  8,
    "sep":  9,
    "oct":  10,
    "nov":  11,
    "dec":  12
}


class AuthenticationException(Exception):
    pass
class TimeoutException(Exception):
    pass


class TwitterError(Exception):
    pass


class StaticTzInfo(tzinfo):
    """A timezone info class that has a constant offset from UTC."""
    _utcoffset = None

    def __init__(self, seconds):
        self._utcoffset = timedelta(seconds=seconds)

    def __str__(self):
        return str(self._utcoffset.seconds)

    def __repr__(self):
        return "<StaticTzInfo %r>" % self._utcoffset.seconds

    def fromutc(self, dt):
        return (dt + self._utcoffset).replace(tzinfo=self)
    
    def utcoffset(self,dt):
        return self._utcoffset

    def dst(self,dt):
        return False

    def tzname(self,dt):
        return u"UTC+%s" % self._utcoffset

    def localize(self, dt, is_dst=False):
        """Convert naive time to local time"""
        if dt.tzinfo is not None:
            raise ValueError, "Not naive datetime (tzinfo is already set)"
        return dt.replace(tzinfo=self)


def parse_time(value, tzinfo):
    """Parse Twitter API time format.
    
    >>> parse_time("Sun Dec 14 11:29:30 +0000 2008", StaticTzInfo(0))
    datetime(2008, 12, 14, 11, 29, 30)
    >>> parse_time("Sun Dec 14 11:29:30 +0000 2008", StaticTzInfo(8))
    datetime(2008, 12, 22, 11, 29, 30)
    """
    if not value:
        return None
    day, month, date, time, timezone, year = value.lower().split()
    hour, min, sec = time.split(u":")
    utc_dt = datetime(int(year), int(MONTHS[month]), int(date), int(hour),
            int(min), int(sec))
    return tzinfo.localize(utc_dt)


def time_call(f, *args, **kwargs):
    t0 = time()
    val = f(*args, **kwargs)
    return val, time() - t0


def num_pages(following_count):
    """Calculate the number of pages required to get all info for all following.
    
    >>> num_pages(1)
    1
    >>> num_pages(100)
    1
    >>> num_pages(101)
    2
    >>> num_pages(155)
    2
    >>> num_pages(200)
    2
    >>> num_pages(201)
    3
    """
    
    n = following_count / settings.TWITTER_FRIENDS_PAGE_LENGTH
    if following_count % settings.TWITTER_FRIENDS_PAGE_LENGTH > 0:
        n += 1
    return n


class Twitter(object):
    """Incomplete Google AppEngine-compatible wrapper for the Twitter API. Uses
    OAuth for authentication.
    
    """
    def __init__(self, access_token=None):
        self.consumer = OAuthConsumer(settings.TWITTER_OAUTH_CONSUMER_KEY,
                settings.TWITTER_OAUTH_CONSUMER_SECRET)
        self.signature_method = OAuthSignatureMethod_HMAC_SHA1()
        if access_token:
            self.access_token = OAuthToken.from_string(access_token)

    def oauth_fetch(self, oauth_request, raw=False):
        url = oauth_request.to_url()
        if oauth_request.http_method == u"POST":
            method = POST
        else:
            method = GET

        try:
            response, secs = time_call(fetch, url, method=method)
            log.info("fetch(\"%s\") took %s secs" % (url, secs))
        except Exception, e:
            if str(e) == u"timed out":
                raise TimeoutException(_(u"Request to Twitter timed out"))
            else:
                raise e

        response_content = response.content # for debugging visibility
        if raw:
            return response_content
        else:
            try:
                data = loads(unicode(response_content))
            except ValueError, e:
                raise TwitterError(_("Tried to load tweets but just got rubbish"
                        u" from Twitter. Confused."))
                log.info(u"RESPONSE CONTENT: %s" % response_content)
            if "error" in data:
                raise TwitterError(data["error"])
            return data

    def load(self, url, method="GET", parameters=None, raw=False):
        oauth_request = OAuthRequest.from_consumer_and_token(self.consumer,
                token=self.access_token, http_url=url, http_method=method,
                parameters=parameters)
        oauth_request.sign_request(self.signature_method, self.consumer,
                self.access_token)
        return self.oauth_fetch(oauth_request, raw)

    def new_request_token(self):
        oauth_request = OAuthRequest.from_consumer_and_token(self.consumer,
                http_url=URL_OAUTH_REQUEST_TOKEN)
        oauth_request.sign_request(self.signature_method, self.consumer, None)
        resp = self.oauth_fetch(oauth_request, raw=True)
        return OAuthToken.from_string(resp)

    def authorisation_url(self, token):
        oauth_request = OAuthRequest.from_consumer_and_token(self.consumer,
                token=token, http_url=URL_OAUTH_AUTHORIZATION)
        oauth_request.sign_request(self.signature_method, self.consumer, token)
        return oauth_request.to_url()

    def exchange_request_token_for_access_token(self, token):
        oauth_request = OAuthRequest.from_consumer_and_token(self.consumer,
                token=token, http_url=URL_OAUTH_ACCESS_TOKEN)
        oauth_request.sign_request(self.signature_method, self.consumer,
                token)
        resp = self.oauth_fetch(oauth_request, raw=True)
        return OAuthToken.from_string(resp) 

    def user(self, screen_name, raw=False):
        """Get info about user."""
        return self.load(URL_USER % screen_name, raw=raw)

    def timeline(self, user_id, count=20, raw=False):
        return self.load(URL_TIMELINE % user_id, parameters={"count": count},
                raw=raw)
    
    def following(self, page, raw=False):
        return self.load(URL_FOLLOWING, parameters={"page": page}, raw=raw)

    def status(self, status_id, raw=False):
        return self.load(URL_STATUS % status_id, raw=raw)
        
    def update(self, status, in_reply_to=None):
        data = {"status": status}
        if in_reply_to:
            data["in_reply_to_status_id"] = in_reply_to
        if getattr(settings, "TWITTER_SOURCE", None):
            data["source"] = settings.TWITTER_SOURCE
        
        response = self.load(URL_UPDATE, parameters=data, method="POST")
