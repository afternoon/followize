from django.conf.urls.defaults import *

from followize.views import index, json_following, json_status, json_timeline, \
        login, logout, home, home_p, post


urlpatterns = patterns("",
    url(r"^$", index, name="index"),
    url(r"^login/$", login, name="login"),
    url(r"^logout/$", logout, name="logout"),
    url(r"^home/$", home, name="home"),
    url(r"^home/p/$", home_p),
    url(r"^post/$", post, name="post"),

    url(r"^json/following/(?P<page>\d+)/$", json_following,
        name="json_following"),
    url(r"^json/status/(?P<status_id>\d+)/$", json_status, name="json_status"),
    url(r"^json/timeline/(?P<username>\w+)/$", json_timeline,
        name="json_timeline")
)
