from django.conf.urls.defaults import *

from followize.views import index, auth, auth_return, auth_clear, home, \
        home_p, post, json_status, json_timeline


urlpatterns = patterns("",
    url(r"^$", index, name="index"),
    
    url(r"^auth/$", auth, name="auth"),
    url(r"^auth/return/$", auth_return, name="auth_return"),
    url(r"^auth/clear/$", auth_clear, name="auth_clear"),

    url(r"^home/$", home, name="home"),
    url(r"^home/p/$", home_p),
    url(r"^post/$", post, name="post"),

    url(r"^json/status/(?P<status_id>\d+)/$", json_status, name="json_status"),
    url(r"^json/timeline/(?P<screen_name>\w+)/$", json_timeline,
        name="json_timeline")
)
