from django.shortcuts import render
from django.shortcuts import render_to_response
from tweets.models import Tweet
from django.http import HttpResponse

import os
from typeahead.settings import PROJECT_ROOT

import json

# Create your views here.

def demo1(request):
    return render_to_response('typeahead_demo.html')

def demo2(request):
    return render_to_response('fulltextsearch_demo.html')

def query(request, query):
    try:
        tweets = Tweet.objects.extra(where=["`tweets_tweet`.`text` LIKE \"%%" + query + "%%\""])
        result = {"options": []}
        for tweet in tweets:
            print tweet
            result["options"].append({"value": tweet.text})
    except Exception, e:
        print e
    
    return HttpResponse(json.dumps(result), content_type="application/json")


def query_fulltext(request, query):
    try:
        tweets = Tweet.objects.filter(text__search=query)
        result = {"options": []}
        for tweet in tweets:
            print tweet
            result["options"].append({"value": tweet.text})
    except Exception, e:
        print e
    
    return HttpResponse(json.dumps(result), content_type="application/json")


def get_tweets(request):
    try:
        file = open(os.path.join(PROJECT_ROOT, 'tweets2.json'))
    except Exception, e:
        print e    

    return HttpResponse(file.read(), content_type="application/json")


def delete_tweets(request):
    print "deleting tweets"
    try:
        t = Tweet.objects.all().delete()
    except Exception, e:
        print e
    return HttpResponse(json.dumps({'result': 'success'}), content_type="application/json")
    

def insert_tweets1(request):
    try:
        file = open(os.path.join(PROJECT_ROOT, 'tweets2.json'))
        tweets = json.loads(file.read())
        tweets = tweets["tweets"]
        for tweet in tweets:
            t = Tweet.objects.create(tweetid=tweet['id'], text=tweet['text'], username=tweet['username'])
    except Exception, e:
        print e    

    return HttpResponse(json.dumps({'result': 'success'}), content_type="application/json")
    