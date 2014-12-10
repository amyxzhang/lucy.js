from django.db import models

# Create your models here.

class Tweet(models.Model):
    text = models.CharField(max_length=200)
    tweetid = models.BigIntegerField();
    username = models.CharField(max_length=30)
    
