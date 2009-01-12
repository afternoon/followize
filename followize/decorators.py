from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect


def username_required(f):
    """The equivalent of being logged in is that the user's Twitter details are
    stored in the session. This decorator checks that.
    
    """
    def f_(request, *args, **kwargs):
        if "username" not in request.session:
            return HttpResponseRedirect(reverse("index"))
        else:
            return f(request, *args, **kwargs)
    return f_
