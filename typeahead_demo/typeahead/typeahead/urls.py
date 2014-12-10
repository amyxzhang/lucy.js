from django.conf.urls import patterns, include, url
from django.contrib import admin

urlpatterns = patterns('',
    # Examples:
    
    url(r'^$', 'tweets.views.index'),
    url(r'^demo1', 'tweets.views.demo1'),
    url(r'^demo2', 'tweets.views.demo2'),
    
    url(r'^search/(?P<query>.+)', 'tweets.views.query'),
    url(r'^search_fulltext/(?P<query>.+)', 'tweets.views.query_fulltext'),
    
    url(r'^insert_tweets1', 'tweets.views.insert_tweets1'),
    url(r'^delete_tweets', 'tweets.views.delete_tweets'),
    
    url(r'^get_tweets', 'tweets.views.get_tweets'),
    
    url(r'^admin/', include(admin.site.urls)),
)
