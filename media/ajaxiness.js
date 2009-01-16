var MONTH_SHORT_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul",
        "Aug", "Sep", "Oct", "Nov", "Dec"];

var SIMPLE_EMAIL_RE = /^\S+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+$/;
var AT_REPLIES_RE = /@(\w+)/g;
var HASHTAGS_RE = /#(\w*[A-Za-z_]\w+)/g;
var LONELY_AMP_RE = /&([^#a-zA-Z0-9])/g;


function ajaxEnabled() {
    $(".userinfo").append(" | <span class=\"ok\">AJAX</span>");
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
    var val = statusNodes.val();
    var n = 140 - val.length;

    var noteNodes = $("#chars_remaining");
    if (noteNodes.length === 0) {
        statusNodes.after('<div class="note">Characters remaining: <span id="chars_remaining">' + n + '</span></div>');
        var noteNodes = $("#chars_remaining");
    }
    else {
        noteNodes.text(n);
    }

    if (n > 0) noteNodes.css("color", "#777");
    else if (n < 0) noteNodes.css("color", "red");
    else noteNodes.css("color", "green");
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
    $("body, html").animate({scrollTop: 0}, 100);
    $("#post_entry").show(50);
    if (typeof text !== "undefined") statusNodes[0].value = text;
    if (typeof in_reply_to !== "undefined") $("#id_in_reply_to")[0].value = in_reply_to;
    focusNoSelection(statusNodes[0]);
}

function hide_post() {
    $("#post_entry").hide(50);
}

function send(anchor) {
    qs = parseQs(anchor.search);
    post(unescape(qs.status), qs.in_reply_to);
}

function timediff(t) {
    var d = new Date(t);
    var delta = (new Date() - d) / 1000;
    var days = Math.floor(delta / 86400);
    var hours = Math.floor((delta % 86400) / 3600);
    var mins = Math.floor((delta % 3600) / 60);
    var secs = Math.floor(delta % 60);
    
    if (days >= 1) {
        dateInTwitTz = new Date(d.getTime() - d.getTimezoneOffset() + timezoneOffset);
        return [MONTH_SHORT_NAMES[d.getMonth()], " ", d.getDate(), ", ",
               d.getHours(), ":", d.getMinutes()].join("");
    }
    else {
        var amount = 0;
        var unit_str = "";

        if (hours > 0) {
            amount = hours;
            unit_str = "hour";
        }
        else if (mins > 0) {
            amount = mins;
            unit_str = "min";
        }
        else {
            amount = secs;
            unit_str = "sec";
        }

        if (amount != 1) unit_str += "s";
        return [amount, unit_str, "ago"].join(" ")
    }
}

function makeLink(text) {
    if (text.indexOf("http://") === 0 || text.indexOf("https://") === 0) {
        return "<a href=\"" + text + "\">" + text + "</a>";
    }
    else if (text.length > 4 && (text.indexOf("www.") === 0 ||
            text.indexOf(".com") === text.length - 4 ||
            text.indexOf(".org") === text.length - 4 ||
            text.indexOf(".net") === text.length - 4)) {
        return "<a href=\"http://" + text + "/\">" + text + "</a>";
    }
    else if (text.indexOf("@") !== -1 && SIMPLE_EMAIL_RE.test(text)) {
        return "<a href=\"mailto:" + text + "/\">" + text + "</a>";
    }
    else return text;
}

function urlize(text) {
    return $.map(text.split(" "), makeLink).join(" ");
}

function atReplies(text) {
    function replace_func(match, name, offset, original) {
        if (offset !== 0 && original[offset - 1] !== " ") {
            return match
        }
        else {
            return ["@<a href=\"http://twitter.com/", name, "\">", name, "</a>"].join("");
        }
    }
    return text.replace(AT_REPLIES_RE, replace_func);
}

function hashtags(text) {
    var replace_text = "#<a href=\"http://hashtags.org/tag/$1/\">$1</a>"
    return text.replace(HASHTAGS_RE, replace_text);
}

function escapeLonelyAmps(text) {
    return text.replace(LONELY_AMP_RE, "&amp;$1");
}

function addLinks(text) {
    return urlize(atReplies(hashtags(escapeLonelyAmps(text))));
}

function getRowUserClass(row) {
    // pull the user class from a row
    if (row.length) var row = row[0];
    var classes = row.className.split(" ");
    for (var i = 0; i < classes.length; i++) {
        if (classes[i].indexOf("user_") === 0) {
            return classes[i];
        }
    }
}

function makeNewRow(row, rowClass, rowUserClass, objectName, sendReplyContent, sendDmContent) {
    // make classes like "old user_afternoon old_user_afternoon"
    var newRow = $('<tr class="' + rowClass + ' ' + rowUserClass + ' ' + rowClass + "_" + rowUserClass + '"></tr>');
    row.after(newRow);

    var newRowHtml = [
        '<td class="profile_image">&nbsp;</td>',
        '<td class="name">&nbsp;</td>',
        '<td class="status">',
            '<span class="loading">Loading ', objectName, '...</span>',
        '</td>',
        '<td class="send_reply">',
            sendReplyContent,
        '</td>',
        '<td class="send_dm">',
            sendDmContent,
        '</td>'
    ];
    newRow.html(newRowHtml.join(""))
    return newRow;
}

function renderTweet(container, type, data) {
    var userInfo = "";
    if (type === "original") {
        userInfo = [
            '<span class="profile_image">',
                '<a href="http://twitter.com/', data.user.screen_name, '" title="', data.user.name, ' &mdash; ', data.user.description, '">',
                    '<img src="', data.user.profile_image_url, '" width="12" height="12" alt="">',
                '</a>',
            '</span> ',
            '<span class="name"><a href="http://twitter.com/', data.user.screen_name, '" title="', data.user.name, ' &mdash; ', data.user.description, '">', data.user.screen_name, '</a></span> ',
        ].join("");
    }

    var in_reply_to = "";
    if (data.in_reply_to_status_id) {
        in_reply_to = [
            '<span class="reply">',
                ' in reply to ',
                '<a href="http://twitter.com/', data.in_reply_to_screen_name, '/status/', data.in_reply_to_status_id, '" title="View ', data.in_reply_to_screen_name, '\'s tweet">',
                    data.in_reply_to_screen_name, 
                '</a>',
            '</span>',
        ].join("");
    }

    var html = [
        userInfo,
        '<span class="text">', addLinks(data.text), '</span> ',
        '<span class="created_at">', timediff(data.created_at), '</span>',
        in_reply_to,
    ];

    container.html(html.join(""));
    enhanceLinks(container);
}

function renderTweets(row, data, objectName) {
    var rowUserClass = getRowUserClass(row);
    if (typeof data.error === "undefined") {
        if (typeof data.user === "undefined") {
            var nextRow = row;
            for (var i = 1; i < data.length; i++) {
                renderTweet($(".status", nextRow), "old", data[i]);
                if (i < data.length - 1) {
                    nextRow = makeNewRow(nextRow, "old", rowUserClass, objectName, "&nbsp;", "&nbsp;");
                }
            }
        }
        else {
            renderTweet($(".status", row), "original", data);
        }
    }
    else {
        $(".status", row).html('<span class="error">Couldn\'t load ' +
                objectName + ' (' + data.error + ').</span>');
    }
}

function loadTweets(row, rowClass, url, objectName, sendReplyContent, sendDmContent) {
    console.log(row, rowClass, url, objectName, sendReplyContent, sendDmContent);
    var newRow = makeNewRow(row, rowClass, getRowUserClass(row), objectName, sendReplyContent, sendDmContent);
    $.ajax({
        type:       "GET",
        url:        url,
        success:    function(data) { renderTweets(newRow, data, objectName); },
        error:      function (e, xhr, options, thrownError) {
                        console.log({"e": e, "xhr": xhr, "options": options, "thrownError": thrownError});
                        $(".status", newRow).html('<span class="error">Couldn\'t load ' + objectName + '.</span>');
                    },
        dataType:   "json"
    });
}

function showOriginal(anchor) {
    var row = $(anchor).parents("tr");
    if (row[0].className.indexOf("user ") === 0) {
        $(anchor).unbind("click").click(function() { hideOriginals(this); return false; });
    }
    else {
        $(anchor).unbind("click").click(function() { return false; });
    }
    var urlBits = anchor.pathname.split("/");
    var screenName = urlBits[1];
    var statusId = urlBits[3];
    var url = "/json/status/" + statusId + "/";
    var objectName = "original tweet";
    var sendReplyContent = '<a href="/post/?status=%40' + screenName + '%20&in_reply_to=' + statusId + '" title="Reply to ' + screenName + '">&#x21ba;</a>';
    var sendDmContent = '<a href="/post/?status=d%20' + screenName + '%20" title="Direct message ' + screenName + '">&#x2709;</a>';

    loadTweets(row, "original", url, objectName, sendReplyContent,
            sendDmContent);
}

function hideOriginals(anchor) {
    var row = $(anchor).parents("tr");
    $(".original_" + getRowUserClass(row)).remove();
    $(anchor).unbind("click").click(function(e) { showOriginal(this); return false; });
}

function findLastUserSiblingRow(row) {
    var rowClass = getRowUserClass(row);
    var siblings = $("#" + rowClass + ", .original_" + rowClass);
    return $(siblings[siblings.length - 1]);
}

function showTimeline(anchor) {
    var row = $(anchor).parents("tr");
    $(".profile_image a, .name a", row).unbind("click").click(function() {
            hideTimeline(this); return false; });
    var siblingRow = findLastUserSiblingRow(row);
    var screenName = anchor.pathname.substring(1);
    var url = "/json/timeline/" + screenName + "/?count=11";
    var objectName = "timeline";

    loadTweets(siblingRow, "old", url, objectName, "&nbsp;", "&nbsp;");
}

function hideTimeline(anchor) {
    var row = $(anchor).parents("tr");
    $(".old_" + getRowUserClass(row)).remove();
    $(".profile_image a, .name a", row).click(function(e) { showTimeline(this); return false; });
}

function enhanceLinks(context) {
    $(".reply a", context).click(function(e) { showOriginal(this); return false; });
    $(".send_reply a, .send_dm a", context).click(function(e) { send(this); return false; });
}

$(document).ready(function() {
    var statusNodes = $("#id_status");
    if (statusNodes.length) {
        statusNodes.keyup(updateCharsRemaining);
        updateCharsRemaining();
        focusNoSelection(statusNodes[0]);
    }

    $(".close a").click(function(e) { hide_post(); return false; })
    $("#post").click(function(e) { post(); return false; });

    // not ready for prime time
    $(".profile_image a, .name a").click(function(e) { showTimeline(this); return false; });

    enhanceLinks();

    ajaxEnabled();
});
