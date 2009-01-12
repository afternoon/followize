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
    var end = input.value.length
    input.setSelectionRange(end, end);
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
    focusNoSelection(statusNodes[0]);
}

$(document).ready(function() {
    var statusNodes = $("#id_status");
    if (statusNodes.length) {
        statusNodes.keypress(updateCharsRemaining);
        updateCharsRemaining();
    }

    ajaxEnabled();
});
