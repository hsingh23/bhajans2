# read translation mapping
import re
import json

translation_mapping = []
with open("translation.csv", 'r') as f:
    translation_mapping = f.readlines()

# read bhajan indexes
supplements = ["2016Supplement.txt", "2015Supplement.txt", "2014Supplement.txt",
               "2013Supplement.txt", "2012Supplement.txt", "2011Supplement.txt"]
for filename in supplements:
    # make substitutions
    with open(filename, 'r') as f:
        content = f.read().lower()
        for line in translation_mapping:
            (searchable, original) = line.split(',')
            original = original.strip()
            content = re.sub(original, searchable, content)
    # write substitutions
    with open(filename + ".changed.txt", 'w+') as f:
        f.write(content)

# merge and sort file
bhajans = {}
changed = [f + ".changed.txt" for f in supplements]
for filename in (changed + ["bhajanmritam.txt"]):
    with open(filename, 'r') as f:
        for line in f.read().lower().split('\n'):
            try:
                (bhajan_name, location) = line.strip().split('##')
                bhajan_name = bhajan_name.strip().lower()
                location = location.strip().lower()
                bhajans[bhajan_name] = bhajans[bhajan_name] + \
                    [location] if bhajan_name in bhajans else [location]
            except Exception as e:
                print filename, line
final_sorted = [bhajan + ' ## ' +
                ','.join(info) for (bhajan, info) in sorted(bhajans.items())]
with open('bhajan-index.txt', 'w+') as f:
    f.write('\n'.join(final_sorted))
with open('bhajan-index.json', 'w+') as f:
    f.write(json.dumps(final_sorted))
with open('../public/bhajan-index.json', 'w+') as f:
    f.write(json.dumps(final_sorted))
