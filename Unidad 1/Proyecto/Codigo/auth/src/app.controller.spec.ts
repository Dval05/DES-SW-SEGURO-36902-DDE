import { AppController } from './app.controller'; describe('AppController',()=>{it('reports AUTH healthy',()=>expect(new AppController().health()).toEqual({status:'ok',service:'auth'}))});
