var global_savedata = [];
var savedata_encoded = '';
//use for global_savedata <-> savefile
var savedata_len = 753;
var savedata_mod = 6;
var savedata_last = savedata_len - parseInt(savedata_len / savedata_mod) * savedata_mod;
//remain new word lists
//wordtype1: normal type2: great type3: priconne
//[remain_words] include all types while [remain_words_nopcr] doesn't include type3 because your computer opponent will not answer any words of type3
var remain_words = {};
var remain_words_num = 0;
var remain_words_nopcr = {};
var remain_words_nopcr_num = 0;
//word lists for increasing weight
var target_words = {};
//settings
var rate_setting = 1;
var display_setting = 1;
var rate_depth = 4;
var rate_priority = 0;

function Init(status = 1) {
  global_savedata = [];
  for (let i = 0; len = savedata_len, i < len; i++) {
    global_savedata.push(status);
  }
  return global_savedata;
}

function Reset(status) {
  editSaveFile(Init(status));
}

//increase weight of these words/kanas
function setTargetWords(weight = 999) {
  var str = document.getElementById('targetwords').value;
  saveToStorage('target_words', str)
  if (str == '' || str == null) {
    target_words = {};
  } else {
    var target_ids = str.split(' ');
    for (var i = 0; len = target_ids.length, i < len; i++) {
      var id = parseInt(target_ids[i]);
      if (id > 0 && id < word_map.length && id != NaN) {
        var kana = word_map[id - 1];
        target_words[kana] = weight;
      }
    }
  }
}

function clearTargetWords() {
  target_words = {};
  document.getElementById('targetwords').value = '';
  saveToStorage('target_words', '')
}

//word_id -> global_savedata
function readWord() {
  Init(0);
  var str = document.getElementById('initword').value;
  var word_id_arr = str.split(' ');
  word_id_arr.map(Number);
  word_id_arr.sort(function (a, b) { return a - b });
  var savedata = global_savedata;
  for (let i = 0; len = word_id_arr.length, i < len; i++) {
    word_id = word_id_arr[i];
    savedata[word_id - 1] = 1;
  }
  editSaveFile(savedata);
}

//savefile -> global_savedata
function readSaveFile() {
  var str = document.getElementById('showword').value;
  var savedata = string64to2(str);
  editSaveFile(savedata);
}

function editSaveFile(savedata) {
  global_savedata = savedata;
  saveToStorage('global_savedata', global_savedata)
  refreshDisplay(global_savedata);
}

function refreshDisplay(savedata) {
  setRemainWords(savedata);
  setRemainWordsNoPCR(savedata);
  writeWord(savedata);
  writeSaveFile(savedata);
}

function editSingleWord(word_id, word_status = 0) {
  global_savedata[word_id - 1] = word_status;
  editSaveFile(global_savedata);
}

//global_savedata -> word_id
function writeWord(savedata) {
  var str = '';
  for (var i = 0; len = savedata.length, i < len; i++) {
    if (savedata[i] == 1) {
      var num = i + 1;
      str += num + ' ';
    }
  }
  document.getElementById('initword').value = str;
}

//global_savedata -> savefile
function writeSaveFile(savedata) {
  var str = savedata.join('');
  var split_len = 6;
  var split_arr = [];
  for (var i = 0; len = savedata.length, i < len; i += split_len) {
    split_arr.push(str.substr(i, split_len));
  }
  var savedata_encoded = string2to64(split_arr);
  document.getElementById('showword').value = savedata_encoded;
  document.getElementById('remain').innerHTML = '输入未点亮图鉴的单词编号，以空格隔开，输入完毕后点确认（剩余：' + remain_words_num + ')';
}

function setRemainWords(savedata) {
  var count = 0;
  remain_words = {};
  for (var i = 0; len = savedata.length, i < len; i++) {
    if (savedata[i] == 1) {
      var kana = word_map[i];
      if (remain_words.hasOwnProperty(kana)) {
        remain_words[kana]++;
      } else {
        remain_words[kana] = 1;
      }
      count++;
    }
  }
  remain_words_num = count;
  //console.log(remain_words)
}

function setRemainWordsNoPCR(savedata) {
  var count = 0;
  remain_words_nopcr = {};
  for (var i = 0; len = savedata.length, i < len; i++) {
    if (savedata[i] == 1 && word_map_rare[i] != '3') {
      var kana = word_map[i];
      if (remain_words_nopcr.hasOwnProperty(kana)) {
        remain_words_nopcr[kana]++;
      } else {
        remain_words_nopcr[kana] = 1;
      }
      count++;
    }
  }
  remain_words_nopcr_num = count;
  //console.log(remain_words_nopcr)
}

function getRemainWords() {
  return remain_words;
}

//Hiragana table input -> give answer
function giveKanaInput(object) {
  var kana = changeKataToHira(object.value.slice(0, 1));
  editSaveFile(global_savedata);
  giveAnswer(kana);
  itsyourturn();
}

//Answer list input -> give answer
function giveWordInput(answer, standpoint = 'answer_myself') {
  var word_id = answer[1];
  var word_name = answer[2];
  var answer_attr = answer[4];
  standpoint = (standpoint == 'answer_myself') ? 'answer_opponent' : 'answer_myself';
  itsyourturn(standpoint);
  if (answer_attr == 1) {
    editSingleWord(word_id);
  }
  var kana = getLastKana(word_name);
  giveAnswer(kana, standpoint);
}

function giveAnswer(kana, standpoint = 'answer_myself') {
  if (!kana_data.hasOwnProperty(kana)) {
    return;
  }
  var answer_all = kana_data[kana];
  var result = [];
  for (var i = 0; len = answer_all.length, i < len; i++) {
    var word_name = answer_all[i];
    var word = word_data[word_name];
    var pic_id = word[0];
    var word_id = word[1];
    var save_status = global_savedata[word_id - 1];
    //do not calculate type3 words of the opponent
    //console.log('standpoint:'+standpoint+' word_id:'+word_id+' rare:');
    //if (!(standpoint == 'answer_opponent' && word_map_rare[parseInt(word_id) - 1] == '3')) {
    var recommend_rate = getRecommendRate(word_name, standpoint);
    var word_answer = new Array(pic_id, word_id, word_name, recommend_rate, save_status)
    result.push(word_answer)
    //}
  }
  result = sortArray(result);
  showAnswer(result, standpoint);
}

function sortArray(array) {
  if (array.length == 0) return;
  var len = array[0][3].length;
  var result = array.sort(function (a, b) {
    if (a[4] == b[4]) {
      switch (rate_priority) {
        case 0:
          for (var i = 0; i < len; i++) {
            if (a[3][i] != b[3][i]) return b[3][i] - a[3][i];
          }
        case 1:
          for (var j = 1; j < len; j += 2) {
            if (a[3][j] != b[3][j]) return b[3][j] - a[3][j];
          }
          for (var i = 0; i < len; i += 2) {
            if (a[3][i] != b[3][i]) return b[3][i] - a[3][i];
          }
        case 2:
          for (var i = 0; i < len; i += 2) {
            if (a[3][i] != b[3][i]) return b[3][i] - a[3][i];
          }
          for (var j = 1; j < len; j += 2) {
            if (a[3][j] != b[3][j]) return b[3][j] - a[3][j];
          }
      }
      return a[1] - b[1];
    } else {
      return b[4] - a[4];
    }
  });
  return result;
}

//display answers on screen
function showAnswer(answers, standpoint = 'answer_myself') {
  document.getElementById(standpoint).innerHTML = '';
  for (var i = 0; len = answers.length, i < len; i++) {
    var answer = answers[i];
    var pic_id = answer[0];
    var word_id = answer[1];
    var word_name = answer[2];
    var recommend_rate = answer[3];
    var rate_str = '';
    if (recommend_rate.length > 0) {
      rate_str += '评分: '
      for (var j = 0; j < recommend_rate.length; j++) {
        rate_str = rate_str + recommend_rate[j] + ' ';
      }
    }
    if (standpoint == 'answer_opponent' && word_map_rare[parseInt(word_id) - 1] == '3') {
      rate_str += '(kaya一般不会回答此单词)'
    }
    var answer_attr = answer[4] == 1 ? 'New!' : '';
    switch (display_setting) {
      case 0:
        var result_str = '  No.' + word_id + ' ' + word_name + ' ' + answer_attr + '<br>' + rate_str + ' ';
        break;
      case 1:
        var result_str = '  No.' + word_id + ' ' + word_name + ' ' + answer_attr;
        break;
      case 3:
        var result_str = rate_str;
        break;
      default:
        var result_str = '';
        break;
    }

    var div1 = document.createElement('div');
    var img = document.createElement('img');
    if((pic_id > 10077 && pic_id < 20000) || (pic_id > 20065)){
      img.setAttribute('class', 'pic2');
    }else{
      img.setAttribute('class', 'pic');
    }
    img.setAttribute('pic-id', pic_id);
    if (answer_attr == 0) {
      img.style = 'opacity:0.6'
    }
    var text = document.createElement('p');
    text.setAttribute('class', 'answer');
    text.innerHTML = result_str;
    div1.appendChild(img);
    div1.appendChild(text);
    document.getElementById(standpoint).appendChild(div1);

    img.onclick = (function (para) {
      var a = para;
      return function () {
        giveWordInput(a, standpoint);
      }
    })(answer);
  }
}

function getRecommendRate(word_name, standpoint) {
  var kana = getLastKana(word_name);
  var remain_words = getRemainWords();
  if (rate_setting == 0) return ['未启用评分']
  var result = (standpoint == 'answer_myself') ? checkRate(dicts, remain_words, remain_words_nopcr, kana, rate_depth) : checkRateForOpponent(dicts, remain_words, remain_words_nopcr, kana, rate_depth);

  for (var i in result) {
    result[i] *= 10;
    var digit = result[i] > 0.000001 ? Math.max(Math.ceil(-Math.log10(result[i])), 2) : 2;
    result[i] = result[i].toFixed(digit);
  }
  return result;
}

var hirakana_data = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをがぎぐげごばびぶべぼぱぴぷぺぽだぢづでどんじずぞあいうえおやゆよわつあいうえおやゆよわつ'
var katakana_data = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲガギグゲゴバビブベボパピプペポダヂヅデドンジズゾぁぃぅぇぉゃゅょゎっァィゥェォャュョヮッ'

//normalized all kanas
function changeKataToHira(kana) {
  for (var i = 0; i < katakana_data.length; i++) {
    if (kana == katakana_data[i]) {
      return hirakana_data[i];
    }
  }
  return kana;
}

function getLastKana(word) {
  var kana_last;
  if (word.slice(-1) == 'ー' || word.slice(-1) == ' ') {
    if (word.slice(-2, -1) == ' ') {
      kana_last = word.slice(-3, -2);
    } else {
      kana_last = word.slice(-2, -1);
    }
  } else {
    kana_last = word.slice(-1);
  }
  kana_last = changeKataToHira(kana_last);
  return kana_last;
}

function string64to2(numbers) {
  var chars = '0123456789abcdefghigklmnopqrstuvwxyzABCDEFGHIGKLMNOPQRSTUVWXYZ?%'
  var result = '';
  for (var i = 0; len = numbers.length, i < len; i++) {
    num10 = chars.indexOf(numbers[i]);
    num2 = num10.toString(2);
    if (num2.length < savedata_mod) {
      let l = num2.length;
      let l_max = i < (len - 1) ? savedata_mod : savedata_last;
      while (l < l_max) {
        num2 = '0' + num2;
        l++;
      }
    }
    result += num2;
  }
  result = result.split('');
  result.map(Number);
  return result;
}

function string2to64(numbers) {
  var chars = '0123456789abcdefghigklmnopqrstuvwxyzABCDEFGHIGKLMNOPQRSTUVWXYZ?%'
  var result = '';
  for (var i = 0; len = numbers.length, i < len; i++) {
    num2 = numbers[i];
    num10 = parseInt(num2, 2);
    result += chars[num10]
  }
  return result;
}

function initPic() {
  str = '';
  for (let i in pic_data) {
    data = pic_data[i];
    pos_left = -(parseInt(data[0])) / 2;
    pos_top = -(parseInt(data[1])) / 2;
    width = parseInt(data[2]) / 2;
    height = parseInt(data[3]) / 2;
    str = str + '[pic-id="' + i + '"]{width:' + width + 'px;height:' + height + 'px;background-position:' + pos_left + 'px ' + pos_top + 'px}\n';
  }
  for (let j in pic_data_2) {
    data = pic_data_2[j];
    pos_left = -(parseInt(data[0])) / 2;
    pos_top = -(parseInt(data[1])) / 2;
    width = 80;
    height = 80;
    str = str + '[pic-id="' + j + '"]{width:' + width + 'px;height:' + height + 'px;background-position:' + pos_left + 'px ' + pos_top + 'px}\n';
  }
  document.getElementById("pic-style").innerHTML = str;
}

//show 'it's your turn' on screen
function itsyourturn(standpoint = 'answer_myself') {
  var dd_myself = document.getElementById('dd_myself');
  var dd_opponent = document.getElementById('dd_opponent');
  if (standpoint == 'answer_myself') {
    dd_myself.setAttribute('style', 'color:black');
    dd_opponent.setAttribute('style', 'color:white');
  } else {
    dd_myself.setAttribute('style', 'color:white');
    dd_opponent.setAttribute('style', 'color:black');
  }
}

//setting functions
function setRate(obj) {
  rate_setting = parseInt(obj.value);
  saveToStorage('rate_setting', rate_setting);
}

function setDisplay(obj) {
  display_setting = parseInt(obj.value);
  saveToStorage('display_setting', display_setting);
}

function setDepth(obj) {
  rate_depth = parseInt(obj.value);
  saveToStorage('rate_depth', rate_depth);
}

function setPriority(obj) {
  rate_priority = parseInt(obj.value);
  saveToStorage('rate_priority', rate_priority);
}

//savefile & settings -> DomStorage
function saveToStorage(name, value) {
  if (window.localStorage) {
    if (name == 'global_savedata') {
      var str = value.join('');
      window.localStorage.setItem(name, str);
    } else
      window.localStorage.setItem(name, value);
  }
}

function readFromStorage() {
  if (window.localStorage) {
    var str = window.localStorage.getItem("global_savedata");
    var data = [];
    if (str != "" && str != null) {
      for (var i = 0; len = str.length, i < len; i++) {
        data.push(parseInt(str[i]));
      }
      global_savedata = data;
      refreshDisplay(global_savedata);
    }
    var str2 = window.localStorage.getItem("target_words");
    if (str2 != "" && str2 != null) {
      document.getElementById('targetwords').value = str2;
      setTargetWords();
    }
    var str3 = window.localStorage.getItem("rate_setting");
    if (str3 != "" && str3 != null) {
      document.getElementById('rate_setting').value = parseInt(str3);
      rate_setting = parseInt(str3);
    }
    var str4 = window.localStorage.getItem("display_setting");
    if (str4 != "" && str4 != null) {
      document.getElementById('display_setting').value = parseInt(str4);
      display_setting = parseInt(str4);
    }
    var str5 = window.localStorage.getItem("rate_depth");
    if (str5 != "" && str5 != null) {
      document.getElementById('rate_depth').value = parseInt(str5);
      rate_depth = parseInt(str5);
    }
    var str6 = window.localStorage.getItem("rate_priority");
    if (str6 != "" && str6 != null) {
      document.getElementById('rate_priority').value = parseInt(str6);
      rate_priority = parseInt(str6);
    }
  } else {
    alert('当前环境不支持自动存档');
  }
}

//Init
initPic();
Init();
readFromStorage();