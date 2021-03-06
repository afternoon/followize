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
        statusNodes.after('<div class="form-note">Characters remaining: <span id="chars_remaining">' + n + '</span></div>');
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
    $("#post_entry").show(50, function() {
        if (typeof text !== "undefined") statusNodes[0].value = text;
        if (typeof in_reply_to !== "undefined") $("#id_in_reply_to")[0].value = in_reply_to;
        focusNoSelection(statusNodes[0]);
    });
}

function hide_post() {
    $("#post_entry").hide(50);
}

function send(anchor) {
    qs = parseQs(anchor.search);
    post(unescape(qs.status), qs.in_reply_to);
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

function makeNewRow(row, rowClass, rowUserClass, objectName) {
    // make classes like "old user_afternoon old_user_afternoon"
    var newRow = $('<tr class="' + rowClass + ' ' + rowUserClass + ' ' + rowClass + "_" + rowUserClass + '"></tr>');
    row.after(newRow);

    var newRowHtml = [
        '<td class="profile_image">&nbsp;</td>',
        '<td class="name">&nbsp;</td>',
        '<td class="status">',
            '<span class="loading">Loading ', objectName, '...</span>',
        '</td>',
        '<td class="send_reply"></td>',
        '<td class="send_retweet"></td>',
        '<td class="send_dm"></td>'
    ];
    newRow.html(newRowHtml.join(""))
    return newRow;
}

function truncate(text, length) {
    if (text.length <= length) return text;
    else return text.substring(0, length - 3) + "...";
}

function renderTweet(row, type, data, sendDm) {
    var statusDatum = $(".status", row);
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
                '<a href="http://twitter.com/', data.in_reply_to_screen_name, '/status/', data.in_reply_to_status_id, '" title="View ', data.in_reply_to_screen_name, '\'s status">',
                    data.in_reply_to_screen_name, 
                '</a>',
            '</span>',
        ].join("");
    }

    var html = [
        userInfo,
        '<span class="text">', addLinks(data.text), '</span> ',
        '<span class="created_at">', timediff(data.created_at), '</span> ',
        '<span class="source">from ', data.source, '</span>',
        in_reply_to
    ];

    statusDatum.html(html.join(""));
    enhanceLinks(statusDatum);

    // add tweet actions
    $(".send_reply", row).html('<a href="/post/?status=@' + data.user.screen_name +
            '%20&in_reply_to=' + data.id + '" title="Reply to ' + data.user.screen_name +
            '">@</a>');
    var retweet = escape(truncate('RT @' + data.user.screen_name + ': ' +
                data.text, 140));
    $(".send_retweet", row).html('<a href="/post/?status=' + retweet +
            '&in_reply_to=' + data.id + '" title="Reply">&#x267a;</a>');
    if (sendDm) {
        $(".send_dm", row).html('<a href="/post/?status=d%20' +
                data.user.screen_name + '%20" title="Direct message ' +
                data.user.screen_name + '">&#x2709;</a>');
    }
}

function renderTweets(row, data, objectName) {
    var rowUserClass = getRowUserClass(row);
    if (typeof data.error === "undefined") {
        if (typeof data.user === "undefined") {
            var nextRow = row;
            for (var i = 1; i < data.length; i++) {
                renderTweet(nextRow, "old", data[i], false);
                if (i < data.length - 1) {
                    nextRow = makeNewRow(nextRow, "old", rowUserClass, objectName);
                }
            }
        }
        else {
            renderTweet(row, "original", data, true);
        }
    }
    else {
        $(".status", row).html('<span class="error">' + data.error + '</span>');
    }
}

function loadTweets(row, rowClass, url, objectName) {
    var newRow = makeNewRow(row, rowClass, getRowUserClass(row), objectName);
    function onSuccess(data) {
        renderTweets(newRow, data, objectName);
    }
    function onError(e, xhr, options, thrownError) {
        console.log({"e": e, "xhr": xhr, "options": options, "thrownError": thrownError});
        $(".status", newRow).html('<span class="error">Couldn\'t load ' + objectName + '.</span>');
    }
    var ajaxOpts = {
        type:       "GET",
        url:        url,
        success:    onSuccess,
        error:      onError,
        dataType:   "json"
    }
    $.ajax(ajaxOpts);
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
    var objectName = "status";

    loadTweets(row, "original", url, objectName);
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

    loadTweets(siblingRow, "old", url, objectName);
}

function hideTimeline(anchor) {
    var row = $(anchor).parents("tr");
    $(".old_" + getRowUserClass(row)).remove();
    $(".profile_image a, .name a", row).click(function(e) { showTimeline(this); return false; });
}

function enhanceLinks(context) {
    $(".reply a", context).click(function(e) { showOriginal(this); return false; });
    $(".send_reply a, .send_retweet a, .send_dm a", context).click(function(e) { send(this); return false; });
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
