/*
 *  Followize utility functions
 */

var fw = fw || {};

fw.util = {
    SIMPLE_EMAIL_RE: /^\S+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+$/g,
    AT_REPLIES_RE: /@(\w+)/g,
    STOCKTWITS_RE: /\$([A-Z]+)/g,
    HASHTAGS_RE: /#(\w*[A-Za-z_]\w+)/g,
    LONELY_AMP_RE: /&([^#a-zA-Z0-9])/g,

    TIMEZONE_OFFSET: 0,
    MONTH_SHORT_NAMES: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug",
            "Sep", "Oct", "Nov", "Dec"],

    log: function(s) {
        if (typeof console !== "undefined") { console.log(s); }
    },

    // generic error logger ajax callback
    logAjaxError: function(params, textStatus) {
        fw.util.log("Error: " + textStatus);
    },

    makeLink: function(text) {
        if (text.indexOf("http://") === 0 || text.indexOf("https://") === 0) {
            return '<a href="' + text + '" target="_blank">' + text + "</a>";
        }
        else if (text.length > 4 && (text.indexOf("www.") === 0 ||
                text.indexOf(".com") === text.length - 4 ||
                text.indexOf(".org") === text.length - 4 ||
                text.indexOf(".net") === text.length - 4)) {
            return '<a href="http://' + text + '/" target="_blank">' + text + '</a>';
        }
        else if (text.indexOf("@") !== -1 && fw.util.SIMPLE_EMAIL_RE.test(text)) {
            return "<a href=\"mailto:" + text + "/\">" + text + "</a>";
        }
        else return text;
    },

    urlize: function(text) {
        return $.map(text.split(" "), fw.util.makeLink).join(" ");
    },

    atReplies: function(text) {
        function replace_func(match, name, offset, original) {
            if (offset !== 0 && original[offset - 1].match(/\w/)) {
                return match
            }
            else {
                return ['@<a href="', twitter.WEB_BASE, '/', name, '" target="_blank">', name, '</a>'].join("");
            }
        }
        return text.replace(fw.util.AT_REPLIES_RE, replace_func);
    },

    stocktwits: function(text) {
        var replace_text = '$<a href="http://www.stocktwits.com/t/$1/" target="_blank">$1</a>';
        return text.replace(fw.util.STOCKTWITS_RE, replace_text);
    },

    hashtags: function(text) {
        var replace_text = '#<a href="http://search.twitter.com/search?q=%23$1" target="_blank">$1</a>';
        return text.replace(fw.util.HASHTAGS_RE, replace_text);
    },

    escapeLonelyAmps: function(text) {
        return text.replace(fw.util.LONELY_AMP_RE, "&amp;$1");
    },

    addLinks: function(text) {
        return fw.util.urlize(fw.util.atReplies(fw.util.stocktwits(fw.util.hashtags(fw.util.escapeLonelyAmps(text)))));
    },

    zeropad: function(i, n) {
        var i_ = i + "";
        while (i_.length < n) { i_ = "0" + i_; }
        return i_;
    },

    timediff: function (t) {
        var d = new Date(t),
            now = new Date(),
            delta = (now - d) / 1000,
            days = Math.floor(delta / 86400);
            hours = Math.floor((delta % 86400) / 3600);
        
        if (days > 0) {
            var dateInTwitTz = new Date(d.getTime() - d.getTimezoneOffset() + fw.util.TIMEZONE_OFFSET),
                result = [
                    fw.util.MONTH_SHORT_NAMES[d.getMonth()],
                    " ",
                    d.getDate(),
                    ", ",
                    d.getHours(),
                    ":",
                    fw.util.zeropad(d.getMinutes(), 2)
                ];

            if (d.getYear() < now.getYear()) {
                result.splice(3, 0, " ", d.getYear() + 1900);
            }
            return result.join("");
        }
        else {
            var mins = Math.floor((delta % 3600) / 60),
                secs = Math.floor(delta % 60),
                amount = 0,
                unit_str = "";

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
            return [amount, unit_str, "ago"].join(" ");
        }
    },

    // prepare user record for being inserted into template
    fixupUser: function(user) {
        if (user) {
            if (!user["status"]) {
                user["status"] = {
                    id: null,
                    text: " ",
                    created_at: "Thu Jan 01 00:00:00 +0000 1970",
                    in_reply_to_status_id: null,
                    source: " "
                };
            }
            user["status"].html = fw.util.addLinks(user["status"].text);
            user["status"].text_escaped = escape(user["status"].text);
            user["status"].created_at_rel = fw.util.timediff(user["status"].created_at);
            user["status"].screen_name = user.screen_name;
            if (user["status"].in_reply_to_status_id !== null) {
                user["status"].in_reply_to = {
                    url: twitter.tweetUrl(user["status"].in_reply_to_screen_name, user["status"].in_reply_to_status_id),
                    screen_name: user["status"].in_reply_to_screen_name
                };
            }
            if (user.screen_name === fw.state.currentUserScreenName) {
                user.me = "me";
            }
            if (user["status"].in_reply_to_screen_name === fw.state.currentUserScreenName) {
                user.reply_to_me = "reply_to_me";
            }
        }
        return user;
    },

    // derive the screen name from an anchor element
    screenNameFromAnchor: function(anchor) {
        var tr = $(anchor).parent().parent(),
            classes = tr.attr("class").split(" ");
        for (var i = 0; i < classes.length; i++) {
            if (classes[i].slice(0, 5) === "user_") {
                return classes[i].slice(5);
            }
        }
        return null;
    },

    focusNoSelection: function(input) {
        input.focus();
        
        // required otherwise Safari selects all text in the input
        if ($.browser.safari) {
            var end = input.value.length
            input.setSelectionRange(end, end);
        }
    },

    parseQs: function(qs) {
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
};
