import csv
import json

file = open('testdata.manual.2009.06.14.csv', 'rt')

tweets_dict = {}

try:
    reader = csv.reader(file)
    for row in reader:
        tweet_id = row[1]
        tweet = row[5]
        tweets_dict[tweet_id] = tweet
finally:
    file.close()
    
json_blob = json.dumps(tweets_dict)    

file2 = open('twitter_converted.json','w')
file2.write(json_blob)
