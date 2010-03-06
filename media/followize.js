
// maintain a cache of all following users and show a sorted listed of them
var cacheAndShow = function() {
    var cache = {};

    return function(users) {
        // add latest page of users to the cache, overwriting any old users
        // from an existing user
        for (var i = 0; i < users.length; i++) {
            cache[users[i].screen_name] = users[i];
        }

        // create an array of the latest users and sort by tweet created_at
        var sorted = [];
        for (f in cache) { sorted.push(cache[f]); }
        sorted.sort(twitter.compareTweetTimesDesc);

        // show the latest users
        show(sorted);
    }
}();

// show users in a table using mustache
var show = function() {
    var containerExpr = "#content";
    var tableExpr = "#data";
    var statusTemplate = '<div class="tweet"><span class="text">{{text}}</span> <span class="created_at">{{created_at}}</span> <span class="source">from {{{source}}}</span></div>';
    var userTemplate = '<tr id="user_{{screen_name}}" class="user user_{{screen_name}}"><td class="profile_image"><a href="http://twitter.com/{{screen_name}}" title="{{name}} &mdash; {{description}}"><img src="{{profile_image_url}}" width="14" height="14" alt=""></a></td><td class="name"><a href="http://twitter.com/{{screen_name}}" title="{{name}}&mdash; {{description}}">{{screen_name}}</a></td><td class="status">{{>status}}</td><td class="send_reply"><a href="/post/?status=@{{screen_name}}%20&amp;in_reply_to={{in_reply_to_status_id}}" title="Reply to {{screen_name}}">@</a></td><td class="send_retweet"><a href="/post/?status=RT%20%40{{screen_name}}%3A%20{{text}}&amp;in_reply_to={{in_reply_to_status_id}}" title="Retweet">&#x267a;</a></td><td class="send_dm"><a href="/post/?status=d%20{{screen_name}}%20" title="Direct message {{screen_name}}">&#x2709;</a></td></tr>';
    var tableHtml = '<table id=\"data\"><tbody></tbody></table>';

    var appendUser = function(user, node) { node.append($.mustache(userTemplate, user, {"status": statusTemplate})); };

    return function(users) {
        $(containerExpr).html(tableHtml);
        var tbody = $("tbody", tableExpr);
        $.map(users, function(user, i) { appendUser(user, tbody); });
    }
}();

function showFollowingRepeatedly() {
    log("Showing latest tweets");
    twitter.following(cacheAndShow);
    return setTimeout(showFollowingRepeatedly, 1000 * 60 * 5); // every 5 mins
}
