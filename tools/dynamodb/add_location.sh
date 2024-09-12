# add initial locations to dynamodb
aws dynamodb put-item --table-name $1 --item file://tools/dynamodb/locations_1.json --region us-west-2
aws dynamodb put-item --table-name $1 --item file://tools/dynamodb/locations_2.json --region us-west-2
