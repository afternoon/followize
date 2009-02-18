from HTMLParser import HTMLParseError
from logging import getLogger
from random import randint

from google.appengine.api import memcache
from google.appengine.api.urlfetch import fetch

from django.conf import settings
from django.utils.translation import ugettext as _

from afternoon.django.templatetags import AT_REPLIES_RE

from twitter import AuthenticationException, num_pages, parse_time, \
        StaticTzInfo, time_call, TimeoutException, Twitter, TwitterError


log = getLogger(__name__)


def verify_credentials(tw):
    data = tw.verify_credentials()
    data["password"] = tw.password
    data = add_retweet(tw, reply_to_me(tw, add_reply_data(tw, data)))
    memcache.set("%s_info" % (tw.username), data,
            settings.FOLLOWIZE_CACHE_TIMEOUT_USER_INFO)
    return data


def user(tw, username=None, ignore_cache=False):
    if not username:
        username = tw.username
    if ignore_cache:
        data = None
    else:
        data = memcache.get("%s_info" % (tw.username))
    if not data:
        data = tw.user(username)
        data["password"] = tw.password
        data = add_retweet(tw, reply_to_me(tw, add_reply_data(tw, data)))
        memcache.set("%s_info" % (tw.username), data,
                settings.FOLLOWIZE_CACHE_TIMEOUT_USER_INFO)
    return data


def session_user(session):
    username = session.get("username", None)
    password = session.get("password", None)
    if not username or not password:
        return None

    tw = Twitter(username, password)
    return user(tw)


def timeline(tw, username):
    timeline = memcache.get("%s_timeline" % username)
    if not timeline:
        timeline = tw.timeline(username)
        memcache.set("%s_timeline" % username, timeline,
                settings.FOLLOWIZE_CACHE_TIMEOUT_TIMELINES)
    return timeline


def add_reply_data(tw, f):
    if "status" in f and f["status"]["in_reply_to_status_id"]:
        matches = AT_REPLIES_RE.match(f["status"]["text"])
        if matches:
            user_data = {"screen_name": matches.groups()[0]}
            f["status"]["in_reply_to_user"] = user_data
    return f


def reply_to_me(tw, f):
    if "status" in f and "in_reply_to_user" in f["status"]:
        reply_to_name = f["status"]["in_reply_to_user"]["screen_name"]
        f["status"]["in_reply_to_me"] = reply_to_name == tw.username
    return f


def truncate(text, length):
    if len(text) <= length:
        return text
    else:
        return text[:length - 3] + u"..."


def add_retweet(tw, f):
    if "status" in f:
        f["status"]["retweet"] = truncate(u"RT @%s: %s" % (f["screen_name"],
            f["status"]["text"]), 140)
    return f


def following_page(tw, page=1):
    data = memcache.get("%s_following_page_%s" % (tw.username, page))
    if not data:
        data = [add_retweet(tw, reply_to_me(tw, add_reply_data(tw, f))) for f in
                tw.following(page)]
        timeout = settings.FOLLOWIZE_CACHE_TIMEOUT_UPDATES + \
                randint(0, settings.FOLLOWIZE_CACHE_TIMEOUT_MAX_DELTA)
        memcache.set("%s_following_page_%s" % (tw.username, page), data,
                timeout)
    return data


def following(tw):
    u = user(tw)
    data = [u]
    pages_to_load = min(settings.FOLLOWIZE_FOLLOWING_LIMIT,
            num_pages(u["friends_count"]))
    for i in range(1, pages_to_load + 1):
        data += following_page(tw, i)

    tzinfo = StaticTzInfo(u["utc_offset"])

    def cmp_following(x, y):
        if "status" not in x:
            return -1
        if "status" not in y:
            return 1
        return cmp(parse_time(x["status"]["created_at"], tzinfo),
                parse_time(y["status"]["created_at"], tzinfo))

    return sorted(data, cmp=cmp_following, reverse=True)
        

def update(tw, status, in_reply_to):
    if u"@" not in status:
        in_reply_to = None
    tw.update(status, in_reply_to)
    u = user(tw, ignore_cache=True)


def is_follower(tw, username):
    other_user = user(tw, username=username)
    return other_user["following"]
