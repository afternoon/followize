from django.forms import CharField, Form, IntegerField


class PostForm(Form):
    status = CharField(max_length=140)
    in_reply_to = IntegerField(required=False)
