from base64 import encodestring
from datetime import datetime
from logging import getLogger
from time import strptime, time
from urllib import urlencode

from google.appengine.api.urlfetch import fetch, GET, POST

from django.conf import settings
from django.utils.simplejson import loads
from django.utils.translation import ugettext as _


log = getLogger(__name__)


class AuthenticationException(Exception):
    pass
class TimeoutException(Exception):
    pass


class TwitterError(Exception):
    pass


def parse_time(value):
    """Parse Twitter API time format.
    
    >>> parse_time("Sun Dec 14 11:29:30 +0000 2008")
    datetime(2008, 12, 14, 11, 29, 30)
    """
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
    day, month, date, time, timezone, year = value.lower().split()
    hour, min, sec = time.split(u":")
    return datetime(int(year), int(MONTHS[month]), int(date), int(hour),
            int(min), int(sec))


def time_call(f, *args, **kwargs):
    t0 = time()
    val = f(*args, **kwargs)
    return val, time() - t0


class Twitter(object):
    """Incomplete Google AppEngine-compatible wrapper for the Twitter API."""

    def __init__(self, username, password):
        self.username = username
        self.password = password

    def get_auth_header(self):
        """Create basic authentication header for Twitter API"""
        cipher = encodestring("%s:%s" % (self.username, self.password))[:-1]
        return {"Authorization": "Basic %s" % cipher}

    def load(self, url, payload=None, method=None):
        if not method:
            method = GET
        if not payload:
            payload = {}

        try:
            response, secs = time_call(fetch, url, payload=urlencode(payload),
                    method=method, headers=self.get_auth_header())
            log.info("fetch(\"%s\") took %s secs" % (url, secs))
        except Exception, e:
            log.info(u"Exception %s, %s" % (type(e), e))

            if str(e) == u"timed out":
                raise TimeoutException(_(u"Request to Twitter timed out"))
            else:
                raise e

        if response.status_code == 401:
            raise AuthenticationException(_(u"Wrong username and password"
                    u" combination"))
        else:
            data = loads(unicode(response.content))
            if "error" in data:
                raise TwitterError(data["error"])
            return data

    def user(self, user_id):
        """Get info about user."""
        data = self.load("http://twitter.com/users/show/%s.json" % user_id)
        log.info(data)
        return data
    
    def following(self, page=1):
        """Get all people followed by auth'd user."""
        return self.load("http://twitter.com/statuses/friends.json?page=%s" % page)
        
    def update(self, status, in_reply_to=None):
        data = {"status": status}
        if in_reply_to:
            data["in_reply_to_status_id"] = in_reply_to
        if getattr(settings, "TWITTER_SOURCE", None):
            data["source"] = settings.TWITTER_SOURCE
        
        log.info(u"Posting for %s: %s (%s)" % (self.username, status,
            in_reply_to))
        response = self.load("http://twitter.com/statuses/update.json",
                payload=data, method=POST)
