var express = require('express');
var app = express();

var sqlite3 = require('sqlite3');
var db = new sqlite3.Database('videoKlub.db');

var bodyParser = require('body-parser');


var session = require('express-session');

app.use(express.static('public'));
app.use(session({secret: "dag4taedf3134rqaf4",resave:false,saveUninitialized:true}));



//cd Downloads/"Seminarski WP"

//PRIKAZ SVIH FILMOVA - RADI
app.get('/filmovi',function(req,res)
{
    db.all("SELECT film.id as id, film.naziv as naziv, zanr.naziv as zanr, film.trajanje as trajanje, film.cena as cena FROM film join zanr on film.sifraZanra = zanr.id", function(err,rows)    
    {
         var rezultat = JSON.stringify(rows);
         res.send(rezultat);
         console.log(rezultat);
    });
});


app.get("/gledaj",function(req,res)
{

    if(req.session.user == null)
    {
        console.log("Korisnik nije prijavljen");
        res.redirect("/registration.html");
    }
    else
    {
        const idFilma = req.query.id;
        const user = req.session.user;
        const cenaFilma = 400.0; //svaki film je 400 din :D    
        db.all(
            "SELECT * FROM korisnik WHERE username=$user and novac >= $cena",
            {
                $user : user,
                $cena : cenaFilma
            },
            function(err,row)
            {
                if(row.length)
                {
                    const stanje = row[0]["novac"];
                    const idKorisnika = row[0]["id"];
                    const novoStanje  = stanje - cenaFilma;
                    console.log("na stanju ", stanje);
                    console.log("row.length: ", row.length);
                    db.run(
                        "UPDATE korisnik SET novac=$stanje WHERE id=$id",
                        {
                            $id : row[0]["id"],
                            $stanje : novoStanje
                        },
                        function(err)
                        {
                            if(err)
                            {
                                console.log("GRESKA PRI AZZURIRANJU BAZE");
                            }
                            else
                            {
                                db.run("INSERT into kupljeno (sifraFilma,sifraKorisnika) values ($idFilma,$idKorisnika)",
                                {
                                    $idFilma : idFilma,
                                    $idKorisnika : idKorisnika
                                },
                                function(err)
                                {
                                    if(err)
                                    {
                                        console.log("Greska pri upisu u bazu");

                                    }
                                    else
                                    {
                                        
                                        res.redirect("/profil.html");
                                    }
                                });
                            }
                        }
                    );
                
                }
                else
                {
                    res.redirect("/profil.html");
                }
            }
            
        );
    }
});


//REGISTRACIJA NOVOG KORISNIKA  - RADI
app.get("/registracija", function(req,res)
{

    db.run(
        'INSERT INTO korisnik (username,password,novac,uloga) VALUES ($user,$pass,$novac,$uloga)',
        {
            $user :req.query.username,
            $pass: req.query.pass,
            $novac: 500,
            $uloga: 'clan'  
        },
        function(err)
        {
            if(err)
                console.log(err.message);
            else {
                console.log("Korisnik je uspesno upisan u bazu");   
                //setovana sesija user
                req.session.user = req.query.username;
                console.log(req.session.user);
            }
        }
    );
    req.session.user = req.query.username;
    res.redirect("/profil.html");
});


//PRIJAVA KORISNIKA
app.get("/prijava",function(req,res)
{
    const user = req.query.usernameLogin;
    const pass = req.query.passLogin;
    
    db.each("SELECT * FROM korisnik WHERE username=$user and password=$pass",
    {
        $user : user,
        $pass : pass
    },
    function(err,row){
        console.log(row);
       if(row){
            console.log("Korisnik je uspesno prijavljen");
            req.session.user = user;
            console.log(req.session.user);
            res.redirect("/profil.html");
       }
       else
       {
         console.log("Korisnik je NIJE uspesno prijavljen");
         res.redirect("/registration.html");
       }

    });
});


//PRIKAZIVANJE PROFILA KORISNIKA
app.get("/profil",function(req,res)
{
    console.log("PROFIL");
    if(!req.session.user)
    {
        console.log("Korisnik nije prijavljen");
        return res.status(401).send();
        
    }
    else{
        const user = req.session.user;
        console.log(user);
        
        db.all("SELECT * FROM korisnik WHERE username=$user",
        {
            $user: user
        }
        ,function(err,row)
        {
            console.log(row);
            var rezultat = JSON.stringify(row); //za JSON ajax
            res.send(rezultat);
            console.log(rezultat);  

            if(err)
            {
                console.log("greska");
            }
            else
            {
                console.log("ok");
            }
        });
    }
});


app.get("/odgledano",function(req,res)
{
    if(!req.session.user)
    {
        console.log("Korisnik nije prijavljen");
        return res.status(401).send();
    }
    const user = req.session.user;
    db.all("SELECT film.naziv FROM kupljeno join film on kupljeno.sifraFilma=film.id join korisnik WHERE korisnik.id=sifraKorisnika and korisnik.username=$user",
    {
        $user : user
    },
    function(err,rows)
    {
        var rezultat = JSON.stringify(rows);
        res.send(rezultat);
        console.log(rezultat);

        if(err)
            console.log(err);
    });

});


app.get("/uplatiNovac",function(req,res)
{
    if(!req.session.user)
    {
        console.log("Korisnik nije prijavljen");
        return res.status(401).send();
    }
    const uplata = parseFloat(req.query.kolicinaZaUplatu);
    const user = req.session.user;
    const stanje = parseFloat(req.query.stanje);
    console.log(uplata,stanje);
    const novoStanje = uplata + stanje;

    db.run("UPDATE korisnik SET novac=$novac WHERE username=$user",
    {
        $novac : novoStanje,
        $user : user
    },
    function(err)
    {
        if(err)
        {
            console.log(err);
        }
        else
        {
            console.log("Stanje na racunu korisnika je uspesno promenjeno!");
            res.redirect("/profil.html");
        }
    });
    
});



//brisanje koriscnikog profila
app.get("/obrisiProfil",function(req,res)
{
    const user = req.session.user;
   
    db.run("DELETE from korisnik where username=$user",{$user : user},function(err){
        if(err)
            console.log(err);
        else
            console.log("Uspesno obrisan");    
    })

    req.session.destroy;
    res.redirect("/registration.html");
});



//SERVER
var server = app.listen(8081,function ()
{
    var host = server.address().address;
    var port = server.address().port;

    console.log("Server startovan na http://%s:%s", host,port);
});

