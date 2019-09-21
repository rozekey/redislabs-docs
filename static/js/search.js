var lunrIndex, pagesIndex;

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

// Initialize lunrjs using our generated index file
function initLunr() {
    if (!endsWith(baseurl,"/")){
        baseurl = baseurl+'/'
    };

    var internalIndex = null;
    var hasToken = localStorage.getItem('auth_token');

    if(hasToken) {
        internalIndex = buildInternalIndex();
    }

    // First retrieve the index file
    $.getJSON(baseurl +"index.json")
        .done(function(index) {
            if(hasToken && internalIndex) {
                index = index.concat(internalIndex);
            }

            pagesIndex = index;
            // Set up lunrjs by declaring the fields we use
            // Also provide their boost level for the ranking
            lunrIndex = new lunr.Index
            lunrIndex.ref("uri");
            lunrIndex.field('title', {
                boost: 15
            });
            lunrIndex.field('tags', {
                boost: 10
            });
            lunrIndex.field("content", {
                boost: 5
            });
            lunrIndex.field("categories", {
                boost: 1
            });
            lunrIndex.field("description", {
                boost: 0
            });        

            // Feed lunr with each file and let lunr actually index them
            pagesIndex.forEach(function(page) {
                lunrIndex.add(page);
            });
            lunrIndex.pipeline.remove(lunrIndex.stemmer)
        })
        .fail(function(jqxhr, textStatus, error) {
            var err = textStatus + ", " + error;
            console.error("Error getting Hugo index file:", err);
        });
}

// Build the index of internal docs
function buildInternalIndex() {
    var url = 'https://api.github.com/repos/RedisLabs/internal-docs/contents/index.json';
    var internalIndex = null;

    $.ajax({
        url: url, 
        type: 'get', 
        dataType: 'html',
        async: false,
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "token IC_ACC_TOKEN");
            xhr.setRequestHeader("Accept", "application/vnd.github.v3.raw");
        },        
        success: function(data) {
            internalIndex = JSON.parse(data);
        },
        error: function(error) {
            console.log("Error getting internal index: ", error);
            return null;
        }
    });   
    
    return internalIndex;
}

/**
 * Trigger a search in lunr and transform the result
 *
 * @param  {String} query
 * @return {Array}  results
 */
function search(query) {
    // Find the item in our index corresponding to the lunr one to have more info
    return lunrIndex.search(query).map(function(result) {
            return pagesIndex.filter(function(page) {
                return page.uri === result.ref;
            })[0];
        });
}

// Let's get started
initLunr();
$( document ).ready(function() {
    var searchList = new autoComplete({
        /* selector for the search box element */
        selector: $("#search-by").get(0),
        /* source is the callback to perform the search */
        source: function(term, response) {
            response(search(term));
        },
        /* renderItem displays individual search results */
        renderItem: function(item, term) {
            var numContextWords = 3;
            var regEx = "(?:\\s?(?:[\\w\!\"\#\$\%\&\'\(\)\*\+\,\-\.\/\:\;\<\=\>\?\@\[\\\]\^\_\`\{\|\}\~]+)\\s?){0";
            var text = item.content.match(
                regEx+numContextWords+"}" +
                    term+regEx+numContextWords+"}");
            if(text && text.length > 0) {
                var len = text[0].split(' ').length;
                item.context = len > 1? '...' + text[0].trim() + '...' : null;
            }
            item.cat = (item.categories && item.categories.length > 0)? item.categories[0] : '';

            var uri = item.uri + '?s=' + term;
            if(item.description === 'internal_content') {                
                uri = uri.replace('content', '').replace('.md', '') + '&si=true';
            }

            return '<div class="autocomplete-suggestion" ' +
                'data-term="' + term + '" ' +
                'data-title="' + item.title + '" ' +
                'data-uri="'+ uri + '"' +
                'data-context="' + item.context + '">' +
                    '<div>' + item.title + '<strong class="category">' + item.cat + '</strong> </div>' +
                    '<div class="context">' + (item.context || '') +'</div>' +
                '</div>';
        },
        /* onSelect callback fires when a search suggestion is chosen */
        onSelect: function(e, term, item) {
            console.log(item.getAttribute('data-val'));
            location.href = item.getAttribute('data-uri');
        }
    });
});
