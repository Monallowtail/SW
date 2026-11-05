import {computeGeometry} from './geometry.js';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,geometry:computeGeometry(data.state,data.level)})}catch(e){self.postMessage({id:data.id,error:String(e)})}};
