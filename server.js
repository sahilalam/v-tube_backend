require('dotenv').config();


const cors=require('cors');
const jwt=require('jsonwebtoken');


const express=require('express');
const app=express();
app.use(cors());
const PORT=process.env.PORT || 3000;

const base64=require('base-64');

const bcrypt=require('bcrypt');
const SR=process.env.SALT_ROUNDS;

const hashPass=async(password)=>{
    try{
        const salt=await bcrypt.genSalt(+SR);
        const hash=await bcrypt.hash(password,salt);
        return hash;
    }
    catch(err)
    {
        throw err;
    }

}

const nodeMailer=require('nodemailer');
const transporter=nodeMailer.createTransport({
    host:process.env.HOST,
    auth:{
        user:process.env.USER,
        pass:process.env.PASS
    },
    tls:{
        rejectUnauthorized:false
    }

})

app.use(express.json());
app.use(express.urlencoded({extended:true}));
const {checkEmail,addUser,login,checkUsername,updatePassword} =require('./db/users.js');
const { addVideo,getVideos,getVideoById}=require('./db/videos.js');
const {addComment,getCommentByIds} =require('./db/comments.js');
const { like,dislike,checkLike}=require('./db/likes.js');

app.post('/register',async(req,res)=>{
    try{
        let email=req.body.email;
        let check=await checkEmail(email);
        if(check)
        {
            console.log("exists")
            res.json({
                message:"User Already Exists!"
            })
        }
        else
        {
           const encrypted_mail=base64.encode(email);
           const href=`${process.env.FRONT_URL}/register/${encrypted_mail}`;
           let html=`<a href=${href}>Click Here</a> to verify your E-Mail`;
           
           let info =await transporter.sendMail({
               from:"Sahil Alam",
               to:email,
               subject:"Verify your mail!",
               text:"Please Click on the below link to verify your mail.",
               html:`${html}`
           });

           res.status(200).json({
               message:"Mail Sent !!! Please Check your mail",
               info
           })

        }
    }
    catch(err)
    {
        console.log(err);
        res.status(500).json({
            message:err.message
        });
    } 
});


app.post('/register/:encrypted_mail',async(req,res)=>{
    try
    {
        let encrypted_mail=req.params.encrypted_mail;
        const email=base64.decode(encrypted_mail);
        const username=req.body.username;
        const password=req.body.password;
        if(username.length && password.length)
        {
            let check=await checkUsername(username);
            if(check)
            {
                res.json({
                    message:"Username already taken,try again with different username"
                })
            }
            else
            {
                const hash= await hashPass(password);
                await addUser(username,hash,email);
                res.status(201).json({
                    message:"User Created!"
                });
            }
        }
        else
        {
            res.status(500).json({
                message:"Either Username or password is empty!"
            });
        }  

    }
    catch(err)
    {
        console.log(err);
        res.status(404).json({
            message:err.message
        });
    }
})


app.post('/login',async(req,res)=>{
    let username=req.body.username;
    let password=req.body.password;
    try{
        const data=await login(username);
        if(data)
        {
            const result=await bcrypt.compare(password,data.password);
            if(result)
            {
                const access_token =await jwt.sign({
                    name:data.name,
                    email:data.email
                },process.env.KEY,{
                    expiresIn:'1h'
                });
                res.status(200).json({
                    access_token,
                    urls:data.urls
                    
                })
            }
            else
            {
                res.status(404).json({
                    message:"Invalid Password"
                })   
            }

        }
        else
        {
            res.status(404).json({
                message:"User Not Found!"
            });
        }
    }
    catch(err)
    {
        console.log(err);
        res.status(500).json({
            message:err.message
        });
    }
}) 

app.post('/forgot_password',async(req,res)=>{
    try{
        let email=req.body.email;
        let check=await checkEmail(email);
        if(check)
        {
            const encrypted_mail=base64.encode(email);
           const href=`${process.env.FRONT_URL}/forgot_password/${encrypted_mail}`;
           let html=`<a href=${href}>Click Here</a> to update your passowrd`;
           
           let info =await transporter.sendMail({
               from:"Sahil Alam",
               to:email,
               subject:"Update your Password!",
               html:`${html}`
           });

           res.status(200).json({
               message:"Mail Sent !!! Please Check your mail"
           })
        }
        else
        {
            res.status(404).json({
                message:"No user fornd with this e-mail"
            })
        }

    }
    catch(err)
    {
        res.status(500).json(
            {
                message:err.message
            }
        )
    }
})

app.put('/forgot_password/:encrypted_mail',async(req,res)=>{
    try{
        let encrypted_email=req.params.encrypted_mail;
        let email=base64.decode(encrypted_email);
        let password=req.body.password;
        const hash=await hashPass(password);
        await updatePassword(email,hash);
        res.status(200).json({
            message:"Password Updated! Please Login to continue.."
        })
    }
    catch(err)
    {
        res.status(500).json(
            {
                message:err.message
            }
        )
    }
})
app.get('/verify_token&get_user_details',async(req,res)=>{
    try{
        let access_token=req.headers.authorization;
        let decoded=await jwt.verify(access_token,process.env.KEY);
        res.status(200).json(
            {
                data:decoded
            }
        )

    }
    catch(err)
    {
        res.status(500).json({
            message:err.message
        })
    }

})
app.post('/add/video',async(req,res)=>{
    try{
        let access_token=req.headers.authorization;
        let decoded=await jwt.verify(access_token,process.env.KEY);
        let name=decoded.name;
        let email=decoded.email;
        let title=req.body.title;
        let category=req.body.category;
        category=category.split(' ');
        let description=req.body.description;
        let date=req.body.date;
        let video_url=req.body.video_url;
        let thumbnail=req.body.thumbnail;
        await addVideo(title,category,description,date,thumbnail,video_url,email,name);
        res.status(201).json({
            message:"Video Added!"
        })
    }
    catch(err)
    {
        res.status(500).json({
            message:err.message
        })
    }
});
app.get('/get/videos/:offset/:category/:from/:to/:myvideos',async(req,res)=>{
    try{
        let access_token=req.headers.authorization;
        let decoded=await jwt.verify(access_token,process.env.KEY);
        let offset=+req.params.offset;
        let filter={};
        let myvideos=+req.params.myvideo;
        if(myvideos)
        {
            const user=await checkEmail(decoded.email);
            filter.myvideos=user.videos;
        }
        let category=req.params.category;
        if(category!=0)
        {
            filter.category=category.split(" ");
        }
        let from=req.params.from;
        if(from!=0)
        {
            filter.date={
                from:from,
                to:req.params.to
            }
            
        }
        const data=await getVideos(offset,filter);
        res.status(200).json(data)
    }
    catch(err)
    {
        console.log(err.message);
        res.status(500).json({
            message:err.message
        })
    }
})

app.get('/get/fullvideo/:video_id',async(req,res)=>{
    try{
        const access_token=req.headers.authorization;
        const decoded=await jwt.verify(access_token,process.env.KEY);
        const data=await getVideoById(req.params.video_id);
        res.status(200).json(data);
    }
    catch(err){
        res.status(500).json({
            message:err.message
        })
    }
})
app.put('/like/:video_id',async(req,res)=>{
    try{
        let access_token=req.headers.authorization;
        let decoded=await jwt.verify(access_token,process.env.KEY);
        let email=decoded.email;
        await like(email,req.params.video_id);
        res.status(201).json({
            message:"liked"
        })
    }
    catch(err)
    {
        res.status(500).json({
            message:err.message
        })
    }
})
app.put('/dislike/:video_id',async(req,res)=>{
    try{
        let access_token=req.headers.authorization;
        let decoded=await jwt.verify(access_token,process.env.KEY);
        let email=decoded.email;
        await dislike(email,req.params.video_id);
        res.status(201).json({
            message:"disliked"
        })
    }
    catch(err)
    {
        res.status(500).json({
            message:err.message
        })
    }
})
app.get('/checklike/:video_id',async(req,res)=>{
    try{
        let access_token=req.headers.authorization;
        let decoded=await jwt.verify(access_token,process.env.KEY);
        let email=decoded.email;
        const check=await checkLike(email,req.params.video_id);
        res.status(200).json(check);

    }
    catch(err)
    {
        res.status(500).json({
            message:err.message
        })
    }
})
app.post('/comment/:video_id',async(req,res)=>{
    try{
        const access_token=req.headers.authorization;
        const decoded=await jwt.verify(access_token,process.env.KEY);
        const email=decoded.email;
        const username=decoded.name;
        const comment=req.body.comment;
        await addComment(username,req.params.video_id,comment);
        res.status(200).json({
            message:"Comment Added!"
        })
    }
    catch(err)
    {
        res.status(500).json(
            {
                message:err.message
            }
        )
    }
})
app.get('/comment/:video_id',async(req,res)=>{
    try{
        const access_token=req.headers.authorization;
        const decoded=await jwt.verify(access_token,process.env.KEY);
        const email=decoded.email;
        const video=await getVideoById(req.params.video_id);
        let comments=video.comments;
        const data=await getCommentByIds(comments);
        res.status(200).json(data)
    }
    catch(err)
    {
        res.status(500).json({
            message:err.message
        })
    }
})

app.listen(PORT,()=>{
    console.log("Server Started");
})