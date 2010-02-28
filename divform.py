from django.forms import Form, CheckboxInput
from django.forms.forms import BoundField
from django.utils.encoding import force_unicode
from django.utils.html import escape
from django.utils.safestring import mark_safe


class DivForm(Form):
    """Child of Form which presents itself using richer markup. Also adds the
    required *, which can't be done with L{django.forms.Form._html_output}
    (as of Apr 30, 2008).
    
    """
    def as_div(self):
        text_row = """<div class="form-line">%(label)s %(field)s %(errors)s %(help_text)s</div>"""
        choice_row = """<div class="form-line-choice">%(field)s %(label)s %(errors)s %(help_text)s</div>"""
        hidden_row = """<div class="form-hidden">%(field)s</div>"""
        error_row = """<div class="form-error">%s</div>"""
        help_text_html = """<div class="form-note">%s</div>"""
        required_html = """<span class="reqicon">*</span>"""

        output, hidden_fields = [], []

        for name, field in self.fields.items():
            bf = BoundField(self, field, name)
            bf_errors = self.error_class([escape(error) for error in bf.errors])

            if bf.is_hidden:
                # Just output the widget row for a hidden field
                hidden = unicode(bf).replace(u" />", u">")
                hidden_fields.append(hidden_row % {"field": hidden})
            else:
                choice_field = isinstance(field.widget, CheckboxInput)

                # Build label HTML, with required * if appropriate
                if bf.label:
                    label = escape(force_unicode(bf.label))
                    required = required_html if field.required else u""
                    label_attrs = {}
                    if choice_field:
                        label_attrs["class"] = "choice"
                    label = bf.label_tag(label + required, attrs=label_attrs) or ""
                else:
                    label = ""

                # Build help text HTML
                if field.help_text:
                    help_text = help_text_html % force_unicode(field.help_text)
                else:
                    help_text = u""

                # Output the row
                if choice_field:
                    template = choice_row
                else:
                    template = text_row
                row_context = {
                    "errors":       force_unicode(bf_errors),
                    "label":        force_unicode(label),
                    "field":        unicode(bf).replace(u" />", u">"),
                    "help_text":    help_text,
                }
                output.append(template % row_context)
        
        return mark_safe(u"\n".join(hidden_fields) + u"\n".join(output))
