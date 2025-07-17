cd ~


cd Desktop/autoupdateip

git pull origin master

if [ ! -f "assets/config.json" ]; then
  npm start
else
  cp assets/config-template.json assets/config.json
  echo "Please fill in the config.json file with your details."
  echo "After filling in the config.json file, run the application again."
  echo "Exiting..."
  exit 1
fi