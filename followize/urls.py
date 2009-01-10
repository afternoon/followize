from django.conf.urls.defaults import *

from followize.views import index, login, logout, home, home_p, post


urlpatterns = patterns("",
    url(r"^$", index, name="index"),
    url(r"^login/$", login, name="login"),
    url(r"^logout/$", logout, name="logout"),
    url(r"^home/$", home, name="home"),
    url(r"^home/p/$", home_p),
    url(r"^post/$", post, name="post"),
)
