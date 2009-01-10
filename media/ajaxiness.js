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

$(document).ready(function() {
    $(".reload").click(reloadFollowing);
});
