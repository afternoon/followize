from divform import DivForm
from django.forms import CharField, IntegerField, TextInput, HiddenInput


class PostForm(DivForm):
    status = CharField(max_length=140, widget=TextInput(attrs={"size": "140"}))
    in_reply_to = IntegerField(required=False, widget=HiddenInput)
