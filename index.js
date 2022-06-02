const express = require("express");
const app = express();
const multer = require('multer');
const db = require('./database');
const axios = require("axios");
const joi = require('joi').extend(require('@joi/date'));
const jwt = require("jsonwebtoken");
const fs = require('fs');
app.use(express.urlencoded({extended:true}));
const upload = multer({ dest: "uploads/" });

//register
app.post("/api/register",async function(req,res){

})

//login
app.post("/api/login",async function(req,res){

})

//confirm email
app.post("/api/email-confirm",async function(req,res){

})

//cari buku berdasarkan judul
app.get("/api/book/title/:judul",async function(req,res){

})

//cari buku berdasarkan penulis
app.get("/api/book/author/:penulis",async function(req,res){

})

//cari buku berdasarkan penerbit
app.get("/api/book/publisher/:penerbit",async function(req,res){
    
})

//cari buku berdasarkan tanggal terbit
app.get("/api/book/publish-date/:tanggal",async function(req,res){
    
})

// format tanggal
function formatDate(date){
    let today = new Date(date);
    let dd = String(today.getDate()).padStart(2, '0');
    let mm = String(today.getMonth() + 1).padStart(2, '0'); 
    let yyyy = today.getFullYear();
    today =yyyy + '/' + mm + '/' + dd;
    return today;
}

//PENGUNJUNG
//meminjam buku
app.post("/api/borrow/:book_id",async function(req,res){
    // ambil id buku dari params
    let book_id = req.params.book_id;
    let id_user=1;

    let user=await db.executeQueryWithParam(`select * from users where id=?`,[id_user]);
    let book=await db.executeQueryWithParam(`select * from book where id=?`,[book_id]);
    if(book.length==0){
        return res.status(404).json({
            status:404,
            msg:"Buku tidak ditemukan"
        })
    }
    if(book[0].status!="available"){
        return res.status(400).json({
            status:400,
            msg:"Buku tidak tersedia"
        })
    }

    if(user[0].saldo<book[0].harga){
        return res.status(400).json({
            status:400,
            msg:"Saldo anda tidak cukup"
        })
    }
    let today = formatDate(new Date());
    let return_date= new Date()
    return_date.setDate(return_date.getDate()+30);
    return_date= formatDate(new Date(return_date));
    await db.executeQueryWithParam(`update book set status='borrowed' where id=?`,[book_id]);
    await db.executeQueryWithParam(`update users set saldo=saldo-? where id=?`,[book[0].harga,id_user]);
    await db.executeQueryWithParam(`insert into borrow values(?,?,?,?,?,?,?)`,['',id_user,book_id,today,return_date,'borrowed',30]);
    
    return res.status(200).json({
        status:200,
        body:{
            ID_Buku:book_id,
            Judul_Buku:book[0].judul,
            Tanggal_Pinjam:today,
            Tanggal_Pengembalian:return_date,
        }
    })
})

//perpanjangan peminjaman buku
app.post("/api/borrow/extend/:id_borrow",async function(req,res){
    let id_borrow=req.params.id_borrow;
    let lama_extend=req.body.lama_extend;
    let id_user=1;
    let borrow=await db.executeQueryWithParam(`select id_user,id_buku,tanggal_pengembalian,status from borrow where id=?`,[id_borrow]);
    if(borrow.length==0){
        return res.status(404).json({
            status:404,
            msg:"Borrow id tidak ditemukan"
        })
    }
    if(borrow[0].status!="borrowed"){
        return res.status(400).json({
            status:400,
            msg:"Peminjaman ini sudah dikembalikan"
        })
    }
    if(borrow[0].id_user!=id_user){
        return res.status(400).json({
            status:400,
            msg:"Bukan user tersebut yang meminjam"
        })
    }
    let date = new Date(borrow[0].tanggal_pengembalian);
    date=date.setDate(date.getDate()+parseInt(lama_extend));
    date= formatDate(new Date(date));

    
    let user=await db.executeQueryWithParam(`select * from users where id=?`,[borrow[0].id_user]);
    let book=await db.executeQueryWithParam(`select * from book where id=?`,[borrow[0].id_buku]);
    let harga_extend=book[0].harga*0.01*lama_extend
    await db.executeQueryWithParam(`update users set saldo=saldo-? where id=?`,[harga_extend,id_user]);
    await db.executeQueryWithParam(`update borrow set tanggal_pengembalian=?,durasi=durasi+? where id=?`,[date,lama_extend,id_borrow]);


    return res.status(200).json({
        status:200,
        body:{
            Judul_Buku:book[0].judul,
            Tanggal_Pengembalian_Lama:borrow[0].tanggal_pengembalian,
            Tanggal_Pengembalian_Baru:date,
        }
    })

})

function calculateDifferenceDate(date2,date1){
    var Difference_In_Time = date2.getTime() - date1.getTime();
    var Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24);
    return Difference_In_Days;
    }

//pengembalian buku
app.post("/api/borrow/return/:id_borrow",async function(req,res){
    let id_borrow=req.params.id_borrow;
    let id_user=1;
    let borrow=await db.executeQueryWithParam(`select id_user,id_buku,tanggal_pengembalian,status from borrow where id=?`,[id_borrow]);
    if(borrow.length==0){
        return res.status(404).json({
            status:404,
            msg:"Borrow id tidak ditemukan"
        })
    }
    if(borrow[0].status!="borrowed"){
        return res.status(400).json({
            status:400,
            msg:"Peminjaman ini sudah dikembalikan"
        })
    }
    if(borrow[0].id_user!=id_user){
        return res.status(400).json({
            status:400,
            msg:"Bukan user tersebut yang meminjam"
        })
    }
    let today = new Date();
    let tanggal_pengembalian = new Date(borrow[0].tanggal_pengembalian);
    let compareDate=today<tanggal_pengembalian;
    let diffDate=calculateDifferenceDate(tanggal_pengembalian,today);
    let book=await db.executeQueryWithParam(`select * from book where id=?`,[borrow[0].id_buku]);
    if(!compareDate){
        let denda=book[0].harga*0.1*Math.abs(diffDate);
        await db.executeQueryWithParam(`update users set saldo=saldo-? where id=?`,[denda,id_user]);
    }
    await db.executeQueryWithParam(`update borrow set status=? where id=?`,['returned',id_borrow]);
    await db.executeQueryWithParam(`update book set status='available' where id=?`,[book[0].id]);
    let user=await db.executeQueryWithParam(`select * from users where id=?`,[borrow[0].id_user]);

    return res.status(200).json({
        status:200,
        body:{
            Judul_Buku:book[0].judul,
            Tanggal_Pengembalian:borrow[0].tanggal_pengembalian,
            Kena_Denda:!compareDate?"Iya":"Tidak",
            Saldo:user[0].saldo
        }
    })

})

//PENJAGA
//tambah buku
app.post("/api/book/add",async function(req,res){

})

//ubah buku
app.put("/api/book/edit",async function(req,res){

})

//hapus buku
app.delete("/api/book/delete",async function(req,res){

})

//confirm peminjaman buku
app.post("/api/borrow/confirm",async function(req,res){

})

//lihat daftar peminjaman buku
app.get("/api/borrow",async function(req,res){

})

//denda pengunjung yang telat mengembalikan buku
app.post("/api/borrow/charge",async function(req,res){

})

//ADMIN
//mengubah role pengunjung menjadi penjaga
app.put("/api/user/role/:id_user",async function(req,res){

    let id_user=req.params.id_user
    let user=await db.executeQueryWithParam(`select * from users where id=?`,[id_user]);
    if(user.length==0){
        return res.status(404).json({
            status:404,
            msg:"User tidak ditemukan"
        })
    }
    if(user[0].role=="librarian"){
        return res.status(400).json({
            status:400,
            msg:"Role user tersebut sudah librarian"
        })
    }

    await db.executeQueryWithParam(`update users set role='librarian' where id=?`,[id_user]);
    
    return res.status(200).json({
        status:200,
        body:`Berhasil mengubah role user ${user[0].nama} menjadi librarian`
    })
})

//ban kepada user
app.post("/api/user/ban/:id_user",async function(req,res){
    let id_user=req.params.id_user
    let user=await db.executeQueryWithParam(`select * from users where id=?`,[id_user]);
    if(user.length==0){
        return res.status(404).json({
            status:404,
            msg:"User tidak ditemukan"
        })
    }
    await db.executeQueryWithParam(`update users set status='banned' where id=?`,[id_user]);
    
    return res.status(200).json({
        status:200,
        body:`Berhasil membanned user ${user[0].nama}`
    })
    
})
app.listen(3000, function () {
    console.log(`Listening to Port 3000`);
});