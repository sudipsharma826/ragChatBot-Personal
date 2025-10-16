import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class EmbeddingsService {
    async getData(){
        const data= await axios.get(process.env.SITE_URL as string);
        return data.data;
    }
}
