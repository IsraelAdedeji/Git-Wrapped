# GitWrapped
GitWrapped is a web based software inspired by the Spotify Wrapped application. It takes a valid github username as input, fetches live data over the github REST API and displays it in a easy to understand slide format.

It includes a heatmap that displays all the users work over the past 90 days, an arch-type generator based on the type of person the algorithm can infer they are from their GitHub account, downloadable share card and other interesting features.

This project used vanilla HTML, CSS and JavaScript for frontend development, the GitHub REST API and the html2canvas library for the downloadable share card.

## How to run locally
In case you want to run it locally, here are the steps you should follow:
1. Clone the Repo
2. Create a config.js file in the root directory
3. Add your GitHub token: `const GITHUB_TOKEN = 'your_token';`
4. Run index.html in your browser/live server

## Images