/*
 *  Twitter
 *
 *  Module for accessing Twitter's API via OAuth-signed JSONP requests. Only
 *  supports read access as JSONP is restricted to GET requests.
 */

// twitter module - just a namespace
var twitter = {
    base: "https://twitter.com",

    oauthToken: "",
    oauthTokenSecret: "",
    oauthConsumerKey: "",

    init: function(params) {
        twitter.oauthToken = params.oauthToken || "";
        twitter.oauthConsumerKey = params.oauthConsumerKey || "";
    },

    // sign ajax request params
    sign: function(params) {
        var message = {
            action:     params.url,
            method:     "GET",
            parameters: params.data
        };

        OAuth.setTimestampAndNonce(message);

        var accessor = {
            token:          twitter.oauthToken,
            consumerKey:    twitter.oauthConsumerKey
        };
        
        OAuth.completeRequest(message, accessor);

        // update the Ajax request to add oauth_ parameters
        params.data = OAuth.getParameterMap(message.parameters);
        return params;
    },

    // request data from Twitter via JSONP and pass data to callback
    load: function(params) {
        params.url = params.url + "?callback=?";
        var signedParams = twitter.sign(params);
        return $.jsonp(signedParams);
    },

    // recursively get all following 100 at a time, fire callback for each 100
    following: function(handlePage, finished, cursor) {
        var c = cursor || -1;
        var fin = finished || function() { return; };
        var followingSuccess = function(data, textStatus) {
            handlePage(data.users);
            if (data.next_cursor !== 0) {
                twitter.following(handlePage, fin, data.next_cursor);
            }
            else {
                fin();
            }
        };
        var followingError = function(params, textStatus) {
            log("Error: " + textStatus);
        }
        twitter.load({
            url:        twitter.base + "/statuses/friends.json",
            data:       {cursor: c},
            success:    followingSuccess,
            error:      followingError
        });
    },

    // comparison function to sort and array of tweets latest first
    compareTweetTimesDesc: function(a, b) {
        var userTime = function(u) { return new Date(u["status"] && u["status"].created_at || u.created_at) };
        return userTime(b) - userTime(a);
    }
};
