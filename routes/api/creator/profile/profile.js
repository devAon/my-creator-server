var express = require('express');
var router = express.Router();

const upload = require('../../../../config/multer');
const defaultRes = require('../../../../module/utils/utils');
const statusCode = require('../../../../module/utils/statusCode');
const resMessage = require('../../../../module/utils/responseMessage');
const db = require('../../../../module/utils/pool');
const authUtil = require('../../../../module/utils/authUtils');
const moment = require('moment');
const jwtUtil = require('../../../../module/utils/jwt');




//4. 크리에이터 프로필 조회
//크리에이터명 프로필사진 크리에이터설명 카테고리(먹방2위)  즐겨찾는유저(팬게시판 좋아요) 구독자 누적조회수 
//랭크 등급, 업적등급
//팬게시판 여부
//랭킹 경험치, 업적 경험치(마스터일땐 경험치 없다)
//랭킹 이미지,업적 이미지!!!! 등급 이미지!!!!!!!!!!!
//순위
//카테고리 먹방 2위!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
router.get('/:creatorIdx', async (req, res) => {
    const { creatorIdx } = req.params;
    const getCreatorProfileQuery = `SELECT c.*,ca.name AS 'category_name',ca.idx AS 'category_idx', 
vg.name AS 'view_grame_name',vg.img_url AS 'view_grade_img_url',vg.view_cnt AS 'view_grade_view_cnt',
fg.name AS 'follower_grade_name',fg.level AS 'follower_grade_level',fg.img_url AS 'follower_grade_img_url',fg.follower_cnt AS 'follower_grade_follower_cnt',
b.idx AS 'board_idx' ,b.name AS 'board_name',b.type AS 'board_type'
    FROM creator c 
    INNER JOIN view_grade vg ON vg.idx = c.view_grade_idx 
    INNER JOIN follower_grade fg ON fg.idx = c.follower_grade_idx 
    INNER JOIN creator_category cc ON cc.creator_idx = c.idx 
    INNER JOIN category ca ON ca.idx = cc.category_idx 
    INNER JOIN board b ON b.creator_idx = c.idx
    WHERE c.idx = ?`;
    const getCreatorProfileResult = await db.queryParam_Parse(getCreatorProfileQuery, [creatorIdx]);

//    const result = getCreatorProfileResult[0];
    const result = JSON.parse(JSON.stringify(getCreatorProfileResult[0][0]));
    console.log("Resutl");
    console.log(result);

    const category_json = JSON.parse(JSON.stringify(getCreatorProfileResult));
    const categoryIdx = category_json[0][0].category_idx;

    if (!result) {
        res.status(200).send(defaultRes.successFalse(statusCode.INTERNAL_SERVER_ERROR, resMessage.CREATOR_SELECT_PROFILE_ERROR));
    } else {
//        res.status(200).send(defaultRes.successTrue(statusCode.OK, resMessage.CREATOR_SELECT_PROFILE_SUCCESS, getCreatorPrifileResult));

  //특정 카테고리별 크리에이터들 리스트
    const getCreatorsQuery=`SELECT cc.creator_idx ,c.*
    FROM creator_category cc 
    INNER JOIN creator c ON c.idx = cc.creator_idx 
    WHERE cc.category_idx = ?
    ORDER BY c.youtube_subscriber_cnt DESC`;

/*
#순위리스트
SELECT cc.creator_idx ,c.*
    FROM creator_category cc 
    INNER JOIN creator c ON c.idx = cc.creator_idx 
    WHERE cc.category_idx = 5
    ORDER BY c.youtube_subscriber_cnt DESC;
    */

    const getCreatorsResult = await db.queryParam_Parse(getCreatorsQuery,categoryIdx);
    const creators_json = JSON.parse(JSON.stringify(getCreatorsResult));


    if(!getCreatorsResult){
        res.status(200).send(defaultRes.successFalse(statusCode.INTERNAL_SERVER_ERROR, resMessage.CREATOR_SELECT_PROFILE_ERROR));
    }else{

    let cnt = 0;
   let cre = '';
        getCreatorsResult[0].forEach((creator)=>{
            cre = JSON.parse(JSON.stringify(creator));
            cree = cre.creator_idx;
            cnt += 1;
            if(creator.creator_idx == creatorIdx){
                const ans = cnt;//2
                result["category_lank"]= ans;


            }
        });

         res.status(200).send(defaultRes.successTrue(statusCode.OK, resMessage.CREATOR_SELECT_PROFILE_SUCCESS, result));


    }
    }
});



//크리에이터 프로필의 스탯조회
//토탈 3.6점해야함!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//192명 참여
//스탯5개

/*
use crecre;
ALTER TABLE board
ADD CONSTRAINT fkcreator_idx
FOREIGN KEY (creator_idx)
REFERENCES creator (idx);


SELECT c.*,c.name AS 'category', b.creator_idx AS 'is_board' 
    FROM creator c INNER JOIN creator_category cc ON c.idx = cc.creator_idx
    INNER JOIN category cg ON cg.idx = cc.category_idx
    INNER JOIN board b ON b.creator_idx = c.idx
    WHERE c.idx = 1717;

*/
router.get('/stat/:creatorIdx', async (req, res) => {
    const { creatorIdx } = req.params;

    const getCreatorPrifileQuery = `SELECT cs.idx,cs.creator_idx,
    COUNT(cs.user_idx) AS'stat_vote_cnt',AVG(cs.stat1) AS'stat1',AVG(cs.stat2)AS'stat2',AVG(cs.stat3)AS'stat3',
    AVG(cs.stat4)AS'stat4',AVG(cs.stat5)AS'stat5'
    FROM creator_stat cs WHERE cs.creator_idx = `;
    const getCreatorPrifileResult = await db.queryParam_Parse(getCreatorPrifileQuery, [creatorIdx]);

    if (!getCreatorPrifileResult) {
        res.status(200).send(defaultRes.successFalse(statusCode.INTERNAL_SERVER_ERROR, resMessage.CREATOR_SELECT_PROFILE_ERROR));
    } else {
        res.status(200).send(defaultRes.successTrue(statusCode.OK, resMessage.CREATOR_SELECT_PROFILE_SUCCESS, getCreatorPrifileResult));
    }
});


//크리에이터 프로필의 스탯 등록(능력평점 참여)
//5개 중 하나라도 미입력시 미입력나오게!!!!!!
//크리에이터 설명 해시태그 #먹방 #대식가는 나중에
//크리에이터 프로필의 스탯 등록 (해쉬태그 등록)
//해쉬태그 설명!!!!!!!!!!! 단어 하나!!!!!!!!!!!!!!!!!!!!!!
router.post('/stat/:creatorIdx', authUtil.isLoggedin, async(req, res) => {
    const {postIdx,comments,is_anonymous} = req.body;
    const userIdx = req.decoded.user_idx;
    const createTime = moment().format("YYYY-MM-DD HH:mm");

    //게시글 있는지
    const getPostQuery = "SELECT * FROM post WHERE idx = ?";
    const getPostResult = await db.queryParam_Parse(getPostQuery, [postIdx]);

    console.log(getPostResult[0]);


     if(!getPostResult || getPostResult.length < 1){
            res.status(200).send(defaultRes.successFalse(statusCode.BAD_REQUEST, resMessage.POSTS_SELECT_NOTHING + `: ${postIdx}`));
    }
    
        const postCommentsQuery = "INSERT INTO reply(post_idx, user_idx, content,create_time,is_anonymous) VALUES(?, ?, ?,?,?)";
        const postCommentsResult = db.queryParam_Parse(postCommentsQuery, [postIdx,userIdx,comments,createTime,is_anonymous], function(result){
            if (!result) {
                res.status(200).send(defaultRes.successFalse(statusCode.INTERNAL_SERVER_ERROR, resMessage.COMMENT_INSERT_ERROR));
            } else {
                res.status(201).send(defaultRes.successTrue(statusCode.OK, resMessage.COMMENT_INSERT_SUCCESS));
            }

    });
});






//해쉬태그 등록
router.post('/hashtag/:creatorIdx', authUtil.isLoggedin, async(req, res) => {
    const {postIdx,comments,is_anonymous} = req.body;
    const userIdx = req.decoded.user_idx;
    const createTime = moment().format("YYYY-MM-DD HH:mm");

    //게시글 있는지
    const getPostQuery = "SELECT * FROM post WHERE idx = ?";
    const getPostResult = await db.queryParam_Parse(getPostQuery, [postIdx]);

    console.log(getPostResult[0]);


     if(!getPostResult || getPostResult.length < 1){
            res.status(200).send(defaultRes.successFalse(statusCode.BAD_REQUEST, resMessage.POSTS_SELECT_NOTHING + `: ${postIdx}`));
    }
    
        const postCommentsQuery = "INSERT INTO reply(post_idx, user_idx, content,create_time,is_anonymous) VALUES(?, ?, ?,?,?)";
        const postCommentsResult = db.queryParam_Parse(postCommentsQuery, [postIdx,userIdx,comments,createTime,is_anonymous], function(result){
            if (!result) {
                res.status(200).send(defaultRes.successFalse(statusCode.INTERNAL_SERVER_ERROR, resMessage.COMMENT_INSERT_ERROR));
            } else {
                res.status(201).send(defaultRes.successTrue(statusCode.OK, resMessage.COMMENT_INSERT_SUCCESS));
            }

    });
});





module.exports = router;