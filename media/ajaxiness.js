function ajaxEnabled() {
    $(".userinfo").append(" | <span class=\"ok\">&#x25cf;</span>");
}

function reloadFollowing(e) {
    if (typeof console === "object") console.log("reloading");
    $.getJSON(
        "http://twitter.com/statuses/friends.json?callback=?",
        function(data, textStatus) {
            if (typeof console === "object") console.log({"textStatus": textStatus, "data": data});
            $.each(data.items, function(i, item) {
                // do something for this item
            });
            setTimeout(reloadFollowing, 300000);
        }
    );
    return false;
}

function focusNoSelection(input) {
    input.focus();
    
    // required otherwise Safari selects all text in the input
    if ($.browser.safari) {
        var end = input.value.length
        input.setSelectionRange(end, end);
    }
}

function updateCharsRemaining(e) {
    var statusNodes = $("#id_status");
    var n = 140 - statusNodes[0].value.length;
    var noteNodes = $("#chars_remaining");
    if (noteNodes.length === 0) {
        statusNodes.after('<div class="note">Characters remaining: <span id="chars_remaining">' + n + '</span></div>');
    }
    else {
        noteNodes.html(n);
    }
}

function parseQs(qs) {
    qs = qs.replace(/^\?/, "").replace(/\&$/, "");
    r = {};
    $.each(qs.split("&"), function() {
        bits = this.split("=");
        key = bits[0];
        val = bits[1];
        if (/^[0-9.]+$/.test(val)) val = parseFloat(val);
        if (val !== "" && val !== null && val !== undefined) r[key] = val;
    });
    return r;
}

function post(text, in_reply_to) {
    var statusNodes = $("#id_status");
    updateCharsRemaining();
    $("body, html").animate({scrollTop: 0}, 100);
    $("#post_entry").show(50);
    statusNodes[0].value = text;
    $("#id_in_reply_to")[0].value = in_reply_to;
    focusNoSelection(statusNodes[0]);
}

function hide_post() {
    $("#post_entry").hide(50);
}

function send(obj) {
    qs = parseQs(obj.search);
    post(unescape(qs.status), qs.in_reply_to);
}

$(document).ready(function() {
    var statusNodes = $("#id_status");
    if (statusNodes.length) {
        statusNodes.keypress(updateCharsRemaining);
        updateCharsRemaining();
        focusNoSelection(statusNodes[0]);
    }

    $(".close a").click(function(e) { hide_post(); return false; })
    $("#post").click(function(e) { post(""); return false; });
    $(".send_reply a, .send_dm a").click(function(e) { send(this); return false; });

    ajaxEnabled();
});
