from appenginepatcher import on_production_server
from os.path import dirname, join


DEBUG = not on_production_server
TEMPLATE_DEBUG = DEBUG

ADMINS = (
    ("Ben Godfrey", "ben@ben2.com"),
)
MANAGERS = ADMINS

DATABASE_ENGINE = "appengine"

TIME_ZONE = "Europe/London"
LANGUAGE_CODE = "en-gb"
DEFAULT_CHARSET = "utf-8"

SITE_ID = 1

USE_I18N = True

MEDIA_ROOT = ""
MEDIA_URL = ""
ADMIN_MEDIA_PREFIX = "/media/"

SECRET_KEY = "U^%D %^%@ !% * /*^  * * /*&^VYDV"

TEMPLATE_LOADERS = (
    "django.template.loaders.filesystem.load_template_source",
    "django.template.loaders.app_directories.load_template_source",
)

MIDDLEWARE_CLASSES = (
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
)

INSTALLED_APPS = (
    "django.contrib.sessions",
    "appenginepatcher",
    "followize",
)

ROOT_URLCONF = "urls"

ROOT_PATH = dirname(__file__)
TEMPLATE_DIRS = (join(ROOT_PATH, "templates"))

DEFAULT_FROM_EMAIL = u"Followize"

DATE_FORMAT = "M j"
DATETIME_FORMAT = "M j, H:i"
TIME_FORMAT = "H:i"

CACHE_BACKEND = "memcached://?timeout=0"

TWITTER_SOURCE = u"followize"
TWITTER_FRIENDS_PAGE_LENGTH = 100

FOLLOWIZE_FOLLOWING_LIMIT = 5
FOLLOWIZE_PAGE_LENGTH = 100
FOLLOWIZE_ADD_LINK_TITLES = False

FOLLOWIZE_CACHE_TIMEOUT_UPDATES = 60 * 2
FOLLOWIZE_CACHE_TIMEOUT_TIMELINES = 60 * 5
FOLLOWIZE_CACHE_TIMEOUT_TITLES = 60 * 60 * 24 * 30
FOLLOWIZE_CACHE_TIMEOUT_USER_INFO = 60 * 60 * 24 * 1
FOLLOWIZE_CACHE_TIMEOUT_MAX_DELTA = 180
