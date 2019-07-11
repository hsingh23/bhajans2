#!/bin/bash
for filename in *.json; do
    cd=jq -r ".[].mp3"
    for link in jq -r ".[].mp3" $filename >> all_sample_urls.txt
done