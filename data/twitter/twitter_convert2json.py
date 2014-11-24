import csv, json
import collections
import random
import sys, argparse

parser = argparse.ArgumentParser()
parser.add_argument("-s", "--sample", help="Only generate a sample of the tweets (0-1)")
args = parser.parse_args()
sample = float(args.sample) or 1;

file = open('training.1600000.processed.noemoticon.csv', 'rtU')

tweets = []

try:
	reader = csv.reader(file)
	
	for row in reader:
		if (random.random() < sample):
			tweet = collections.OrderedDict()
			tweet['id'] = row[0]
			tweet['date'] = row[1]
			tweet['username'] = row[2]
			tweet['text'] = row[3].decode('latin-1')
			tweets.append(tweet);
finally:
	file.close()
	
json_blob = json.dumps(collections.OrderedDict([
	('__meta', {
		'tweets': {'keyPath': 'id'}
	}),
	('tweets', tweets)
]))

file2 = open('../tweets.json','w')
file2.write(json_blob)
