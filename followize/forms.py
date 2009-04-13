from afternoon.django.forms import AsDivForm
from django.forms import CharField, IntegerField, TextInput, HiddenInput


class PostForm(AsDivForm):
    status = CharField(max_length=140, widget=TextInput(attrs={"size": "140"}))
    in_reply_to = IntegerField(required=False, widget=HiddenInput)
