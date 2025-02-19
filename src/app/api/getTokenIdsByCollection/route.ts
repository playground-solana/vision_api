import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { Keypair, Connection, PublicKey, MemcmpFilter, GetProgramAccountsConfig } from '@solana/web3.js';
import { getTokenMetadata } from "@solana/spl-token";
import { SDK } from '@maweiche/react-sdk';
import base58, * as bs58 from "bs58";

export async function POST(request: Request) {
    let sdk: SDK;
    try{
        const body = await request.json();
        const collectionOwner = new PublicKey(body.collectionOwner);

        // CREATE A curl command with the above body to this endpoint
        // curl -X POST https://vision-api-ecru.vercel.app/api/getTokenIdsByCollection -H "Content-Type: application/json" -d '{"collectionOwner": "6DgMcaPTjSvgSkPfNN71u1i1T1fmfYAbLovE1MgJ1kq9"}'
        // curl -X POST http://localhost:3000/api/getTokenIdsByCollection -H "Content-Type: application/json" -d '{"collectionOwner": "HZxkqBTnXtAYoFTg2puo9KyiNN42E8Sd2Kh1jq3vT29u"}'
        // curl -X POST https://vision-api-ecru.vercel.app/api/claim -H "Content-Type: application/json" -d '{"collectionOwner": "6DgMcaPTjSvgSkPfNN71u1i1T1fmfYAbLovE1MgJ1kq9", "publicKey": "DEVJb1nq3caksGybAFxoxsYXLi9nyp8ZQnmAFmfAYMSN"}'
        
        const keypair1 = process.env.ADMINKEYPAIR as string;
        const admin = Keypair.fromSecretKey(base58.decode(keypair1));
        const adminWallet = new NodeWallet(admin);
        
        const connection = new Connection(process.env.RPC!, 'confirmed')
        sdk = new SDK(
            adminWallet as NodeWallet,
            connection,
            { skipPreflight: true},
            "mainnet-beta",
        );
        const collection = PublicKey.findProgramAddressSync([Buffer.from('collection'), collectionOwner.toBuffer()], sdk.program.programId)[0];
        // const collection = new PublicKey("2xYCWnRvpVf2yk2PcPphJzABqn7PQ4FWmAjWHKXKXp22")
        console.log('sdk program', sdk.program.programId.toBase58())
        console.log('collection owner', collectionOwner.toBase58())
        console.log('collection', collection.toBase58())

        const memcmp_filter: MemcmpFilter = {
            memcmp: {
              offset: 16,
              bytes: collection.toBase58()
            }
          };
          const get_accounts_config: GetProgramAccountsConfig = {
              commitment: "confirmed",
              filters: [
                memcmp_filter,
                // { dataSize: 170 }
              ]
          };
      
          const all_nfts: any = await connection.getProgramAccounts(
            sdk.program.programId, 
            get_accounts_config
          );
          // console.log('all_nfts', all_nfts[1])
      
          if(all_nfts.length === 0) {
            return new Response(JSON.stringify({
                tokenIds: []
            }), { status: 200 });
          }
          const all_nfts_decoded = all_nfts.map((nft: any) => {
              try {
                  const decode = sdk.program.coder.accounts.decode("AiNft", nft.account.data);
                  
                  if(!decode) {
                    return null;
                  }
                  console.log('decoded nft', decode)
                   return {
                      pubkey: nft.pubkey.toBase58(),
                      id: Number (decode.id),
                      collection: decode.collection.toBase58(),
                      reference: decode.reference,
                      price: decode.price,
                      timestamp: Number(decode.timestamp)
                    };
                  
              } catch (error) {
                  console.log('error', error)
                  return null;
              }
          })
          // filter out any null values
          const filtered_nfts = all_nfts_decoded.filter((nft: any) => nft !== null);

          const _tokenid_list = []
          for( let i = 0; i < filtered_nfts.length; i++ ) {
            //Parse the account data
            const nft = filtered_nfts[i];
            console.log('nft', nft)
            const _nft_mint = PublicKey.findProgramAddressSync([Buffer.from('mint'), new PublicKey(nft.pubkey).toBuffer()], sdk.program.programId)[0];
            const tokenMetadata = await getTokenMetadata(connection, _nft_mint);
                  console.log('tokenMetadata*****', tokenMetadata)
      
            const additionalMetadata = tokenMetadata?.additionalMetadata ?? [];
            
            // token id will be the last element in the additionalMetadata array
            const token_id = additionalMetadata.pop()![1];
      
            console.log('token_id', token_id)
      
            _tokenid_list.push({
              token_id: token_id,
              mint: _nft_mint.toBase58(),
            })
          }
        
        return new Response(JSON.stringify({
            tokenIds: _tokenid_list
        }), { status: 200 });
    } catch (error) {
        return new Response(error as string, { status: 500 });
    }
}
