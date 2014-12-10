from django.conf.urls import patterns, include, url
from django.contrib import admin

urlpatterns = patterns('',
    # Examples:
    
    
    url(r'^$', 'tweets.views.home'),
    
    url(r'^search/(?P<query>[\w-]+)', 'tweets.views.query'),
    
    url(r'^insert_tweets', 'tweets.views.insert_tweets'),
    url(r'^delete_tweets', 'tweets.views.delete_tweets'),
    
    url(r'^admin/', include(admin.site.urls)),
)
