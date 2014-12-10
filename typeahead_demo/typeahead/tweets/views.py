from django.shortcuts import render
from django.shortcuts import render_to_response

from django.http import HttpResponse

import json

# Create your views here.

def home(request):
    return render_to_response('typeahead_demo.html')

def query(request, query):
    print query
    return HttpResponse(json.dumps({'query': query}), content_type="application/json")

def delete_tweets(request):
    t = Tweet.objects.all().delete()
    return HttpResponse(json.dumps({'result': 'success'}), content_type="application/json")
    

def insert_tweets(request):
    tweets = request.POST['tweets']
    
    for tweet in tweets:
        print tweet
        t = Tweet.objects.create(tweetid=tweet.id, text=tweet.text, date=tweet.date, username=tweet.username)
        

    return HttpResponse(json.dumps({'result': 'success'}), content_type="application/json")
    