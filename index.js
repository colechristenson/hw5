//Cole Christenson
//HW5 node code

var Express = require("express");
var app = Express();
var usergrid = require('usergrid')
var UsergridClient = require('./node_modules/usergrid/lib/client')
var vault = require('avault').createVault(__dirname);
var async = require('async')

vault.get('myVault', function (profileString) {
      
    var profile = JSON.parse(profileString);
    var orgName = profile.var1;
    var appName = profile.var2;
    var appID = profile.var3;
    var orgID = profile.var4;
    var theClientID = profile.var5;
    var theSecret = profile.var6;
    var theURL = "https://apibaas-trial.apigee.net"  

    var usergrid = new UsergridClient
    ({
        "appId": appName,
        "orgId": orgName,
        "baseUrl": theURL 
    })

usergrid.setAppAuth(theClientID, theSecret)

function getInfo(req, res, query){
	async.waterfall([											//waterfall is needed so that I can make multiple usergrid requests
		function getMovieInfo(callback){
		  usergrid.GET('movies', query, function(error, usergridResponse, entities) { //gets all movies with the query string specified
            response = []															  //makes an array that will be pushed into
            for (i in usergridResponse.entities)									  //loops through the results
            {
                temp = {}
                temp.movie = usergridResponse.entities[i].name
                temp.year = usergridResponse.entities[i].year
                temp.actors = usergridResponse.entities[i].actors            	
            	response.push(temp)                                     //adds to the array an object that has                                                         //the movie name year a list of actors
            }
            callback(null, response);									//passes response onto getMovieReviews
		})
		},
		function getMovieReview(response, callback){
			if(req.query.reviews == "true"){
			usergrid.GET('movie_reviews', function(error, usergridResponse, entities){			//pulls in all movieReviews
		      	for(j in usergridResponse.entities){
					temp = {}
					temp.quote = usergridResponse.entities[j].quote
		            temp.reviewer_name = usergridResponse.entities[j].reviewer_name
		            temp.stars = usergridResponse.entities[j].stars
		         	for(i in response){																		//adds the right review to the right movie
		         		if(response[i].movie == usergridResponse.entities[j].movie && !response[i].reviews)	//creates a review array if they is not already one
		         		{
		         			response[i].reviews = []
		         			response[i].reviews.push(temp)
		         		}
		         		else if(response[i].movie == usergridResponse.entities[j].movie)	//pushes to the review array if there is one already
		         			response[i].reviews.push(temp)
		         	}
		        
		      }
		        callback(null, response);
	       	})
			}
			else
				callback(null, response);
		}
	], function(err, result){
		if(result.length == 0)
			res.json({"Message": "Could not be found in the database"})
		else
			res.json(result)
	})
}

//returns all of the movies in the database
app.get('/movies/list', function(req, res){
	getInfo(req, res, '?ql = actors')  //query will return all movies in the database
});

//Returns all movies with the actor movie_actor
app.get('/movies/actor/:movie_actor', function(req, res){
	query = "?ql=actors = " + "'" + req.params.movie_actor +"'"
	getInfo(req,res, query);
});

//returns all of the movies from that year
app.get('/movies/year/:movie_year', function(req, res){
	query = "?ql=year = " + "'" + req.params.movie_year +"'"
	getInfo(req,res, query);
});

//returns one movie with the title movie_title
app.get('/movies/title/:movie_title', function(req, res){
 	query = "?ql=year = " + "'" + req.params.movie_year +"'"
 	getInfo(req,res, query);
});

app.post('/movies/addmovie', function(req, res){
        new_movie = req.query
        usergrid.GET('movies', new_movie.name, function(error, usergridResponse, entities){			//checks if the movie with the same name is in the DB
        	res_error = []

        	if(usergridResponse.entities)
        		res.json({"Message": "Movie is already in the database"})
        	else{        		
	        	if(new_movie.name.length == 0 || typeof new_movie.name != "string")
	            	res_error.push("Invalid title")
		        if(typeof new_movie.year != "string" || new_movie.year > 2017 || new_movie.year < 1890)
		            res_error.push("Invalid year " + new_movie.year)
		        if(new_movie.actors.length < 3 )
		            res_error.push("Invalid number of actors")

		        if(res_error.length)
		     		res.json(res_error)
		        else{
		        var entity = {
		            type: 'movies',
		            name: new_movie.name,
		            actors: JSON.parse(new_movie.actors),
		            year: new_movie.year
		        }

		        usergrid.POST("movies", entity, function(error, usergridResponse, entities){
		            usergrid.GET('movies', entity.name, function(error, usergridResponse, entities){
		                response = []
		                if(entities)
		                {
		                    response.push({"Message": "Post was successful"})
		                    response.push(entity)
		                }
		                else
		                    response.push({"Message": "Post was unsuccessful"})

		                res.json(response)
		            })
	        	});
		      }
	        }
	    })
});

app.post('/reviews/addreview', function(req, res){
	review = req.query
	usergrid.GET('movies', review.movie, function(error, usergridResponse, entities) {
		if(!usergridResponse.entities)
			res.json({"Message": "No movie " + review.movie + " is in the database"})
		else{
			res_error = []
			if (!review.name)
				res_error.push("Need a name for the review")
			if(!review.quote)
				res_error.push("Need a quote")
			if(!review.reviewer_name)
				res_error.push("Need a reviewer name")
			if(!review.stars)
				res_error.push("Need a star rating")

			if(res_error.length)
				res.json(res_error)
			else{
				var entity = {
		            type: 'movie_reviews',
		            name: review.name,
		            movie: review.movie,
		            quote: review.quote,
		            stars: review.stars
		        }
		    
			    usergrid.GET('movie_reviews', entity.name, function(error, usergridResponse, entities){
			        response = []
			        if(!usergridResponse.entities)
			        {
			            response.push({"Message": "Post was successful"})
			            response.push(entity)
			            usergrid.POST('movie_reviews', entity, function(error, usergridResponse, entities){});
			        }
			       	else
			   	        response.push({"Message": "Post was unsuccessful"})

		            res.json(response)
			        
		        });
	        };
	        }
			
		})
})

app.delete('/movies/deletemovie/:movieToDelete', function(req, res){
	console.log(req.params.movieToDelete)
    usergrid.GET('movies', req.params.movieToDelete, function(error, usergridResponse, entities) { 
        if(error)
            res.json({"Message": req.params.movieToDelete + " not found"});
        else{
            usergrid.DELETE('movies', req.params.movieToDelete, function(error, usergridResponse){
                res.json({"Message": req.params.movieToDelete + " deleted"});
            })
        }  
    });
});

});		//for the vault

app.listen('1337');