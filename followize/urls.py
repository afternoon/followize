from django.conf.urls.defaults import *

from followize.views import index, auth, auth_return, auth_clear, home


urlpatterns = patterns("",
    url(r"^$", index, name="index"),
    
    url(r"^auth/$", auth, name="auth"),
    url(r"^auth/return/$", auth_return, name="auth_return"),
    url(r"^auth/clear/$", auth_clear, name="auth_clear"),

    url(r"^home/$", home, name="home"),
)
