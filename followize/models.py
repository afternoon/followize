from HTMLParser import HTMLParseError
from logging import getLogger
from random import randint

from google.appengine.api import memcache
from google.appengine.api.urlfetch import fetch

from django.conf import settings
from django.utils.translation import ugettext as _

from BeautifulSoup import BeautifulSoup

from afternoon.django.templatetags import AT_REPLIES_RE

from twitter import AuthenticationException, num_pages, parse_time, time_call, \
        TimeoutException, Twitter, TwitterError


log = getLogger(__name__)


def user(tw, ignore_cache=False):
    if ignore_cache:
        data = None
    else:
        data = memcache.get("%s_%s_info" % (tw.username, tw.password))
    if not data:
        data = tw.user()
        data["password"] = tw.password
        data = link_titles(tw, reply_to_me(tw, add_reply_data(tw, data)))
        memcache.set("%s_%s_info" % (tw.username, tw.password), data,
                settings.FOLLOWIZE_CACHE_TIMEOUT_USER_INFO)
    return data


def session_user(session):
    username = session.get("username", None)
    password = session.get("password", None)
    if not username or not password:
        return None

    tw = Twitter(username, password)
    return user(tw)


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
        memcache.set("%s_title" % url, title,
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


def following_page(tw, page=1):
    data = memcache.get("%s_following_page_%s" % (tw.username, page))
    if not data:
        data = [link_titles(tw, reply_to_me(tw, add_reply_data(tw, f)))
                for f in tw.following(page)]
        timeout = settings.FOLLOWIZE_CACHE_TIMEOUT_UPDATES + \
                randint(0, settings.FOLLOWIZE_CACHE_TIMEOUT_MAX_DELTA)
        memcache.set("%s_following_page_%s" % (tw.username, page), data,
                timeout)
    return data


def cmp_following(x, y):
    return cmp(parse_time(x["status"]["created_at"]),
            parse_time(y["status"]["created_at"]))


def following(tw):
    u = user(tw)
    data = [u]
    pages_to_load = min(settings.FOLLOWIZE_FOLLOWING_LIMIT,
            num_pages(u["friends_count"]))
    for i in range(1, pages_to_load + 1):
        data += following_page(tw, i)
    return sorted(data, cmp=cmp_following, reverse=True)
        

def update(tw, status, in_reply_to):
    tw.update(status, in_reply_to)
    u = user(tw, ignore_cache=True)
