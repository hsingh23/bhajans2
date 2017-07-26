# read translation mapping
import re
import json

translation_mapping = []
with open("translation.csv", 'r') as f:
    translation_mapping = f.readlines()

# read bhajan indexes
supplements = ["Vol7.txt", "2017Supplement.txt", "2016Supplement.txt", "2015Supplement.txt", "2014Supplement.txt",
               "2013Supplement.txt", "2012Supplement.txt", "2011Supplement.txt"]
for filename in supplements:
    # make substitutions
    with open(filename, 'r') as f:
        content = f.read().lower()
        for line in translation_mapping:
            (searchable, original) = line.split(',')
            original = original.strip()
            content = re.sub(original, searchable, content)
    # write substitutionse
    with open(filename + ".changed.txt", 'w+') as f:
        f.write(content)

# merge and sort file
bhajans = {}
supplement_tags = {}
changed = [f + ".changed.txt" for f in supplements]
for filename in (["bhajanmritam.txt"] + changed):
    with open(filename, 'r') as f:
        for line in f.read().lower().split('\n'):
            try:
                if len(line.strip()) > 0:
                    (bhajan_name, location) = line.strip().split('##')
                    bhajan_name = bhajan_name.strip()
                    if (filename.find('bhajanmritam.txt') != 0):
                        # Brittle Hack, remove tags from sumplements
                        try:
                            match = re.match(r"(.+?) *([\(\[].*)", bhajan_name)
                            bhajan_name = match.group(1)
                            tag = re.sub(r"\s*[\(\[\)\]]\s*",
                                         ",", match.group(2))
                            tags = [x for x in tag.split(',') if len(x) > 0]
                            print tags
                            supplement_tags[bhajan_name] = tags
                        except Exception, e:
                            pass
                    location = re.split(' *[/\,] *', location.strip())
                    bhajans[bhajan_name] = bhajans[bhajan_name] + \
                        location if bhajan_name in bhajans else location
            except Exception as e:
                print filename, line
final_sorted = [bhajan + ' ## ' +
                ','.join(info) for (bhajan, info) in sorted(bhajans.items())]

bhajans2 = {}
for bhajan, location in bhajans.items():
    bhajans2[bhajan] = {"l": location, 'n': bhajan}


def mergeData(filename, key):
    with open(filename, 'r') as f:
        for line in f.read().lower().split('\n'):
            if len(line.strip()) > 0:
                (bhajan, data) = line.strip().split('##')
                if (bhajan in bhajans2 and 'n' in bhajans2[bhajan]):
                    bhajans2[bhajan][key] = re.split('\s*,\s*', data)
                else:
                    print bhajan, data


mergeData('video.txt', 'v')
mergeData('sheetmusic.txt', 's')
mergeData('tags.txt', 't')

for (bhajan, tags) in supplement_tags.iteritems():
    if bhajan in bhajans2:
        if 't' in bhajans2[bhajan]:
            bhajans2[bhajan]['t'].extend(tags)
        else:
            bhajans2[bhajan]['t'] = tags

with open('bhajan-index.txt', 'w+') as f:
    f.write('\n'.join(final_sorted))
with open('bhajan-index.json', 'w+') as f:
    f.write(json.dumps(final_sorted))
with open('../public/bhajan-index.json', 'w+') as f:
    f.write(json.dumps(final_sorted))
with open('../public/bhajan-index2.json', 'w+') as f:
    f.write(json.dumps([v for (k, v) in sorted(bhajans2.items())]))

from subprocess import call
call(["node", "cdbaby/mergelinks.js"])
