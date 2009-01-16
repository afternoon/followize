from django.core.urlresolvers import reverse
from django.http import HttpResponse, HttpResponseRedirect


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


def return_json(f):
    """Return value is JSON. Tell the browser."""
    def f_(request, *args, **kwargs):
        try:
            response = f(request, *args, **kwargs)
        except Exception, e:
            response = """{"error": "%s"}""" % e.message
        return HttpResponse(response, mimetype=u"application/json")
    return f_
