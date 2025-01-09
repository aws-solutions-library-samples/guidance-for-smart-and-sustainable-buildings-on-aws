pip install -t lib/lambda/layer/open-weather-map/python -r lib/lambda/layer/open-weather-map/requirements.txt
pip install -t lib/lambda/layer/requests/python -r lib/lambda/layer/requests/requirements.txt

cd lib/lambda/gdk-publish
npm ci
npm run build
cd ../../../