from django import template
from django.conf import settings

from afternoon.django.templatetags import timediff, twitter_links

from twitter import parse_time, StaticTzInfo


register = template.Library()


register.filter(twitter_links)


@register.filter
def twitter_timediff(value, user):
    return timediff(parse_time(value, StaticTzInfo(user["utc_offset"])))
