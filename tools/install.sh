# Install latest Python (3.13.2 as of 2025/02/15)
sudo dnf install -y gcc zlib-devel bzip2-devel readline-devel sqlite sqlite-devel openssl-devel tk-devel libffi-devel xz-devel
git clone https://github.com/pyenv/pyenv.git ~/.pyenv
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bashrc
echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(pyenv init -)"' >> ~/.bashrc
source ~/.bashrc
pyenv install 3.13.2
pyenv global 3.13.2

# Install Lambda Layer Dependencies
pip install -t lib/lambda/layer/open-weather-map/python -r lib/lambda/layer/open-weather-map/requirements.txt
pip install -t lib/lambda/layer/requests/python -r lib/lambda/layer/requests/requirements.txt

# Build js file for Lambda
cd lib/lambda/gdk-publish
npm ci
npm run build
cd ../../../

